// Socket.IO client for real-time communication with backend
import { io, Socket } from "socket.io-client";
import * as SecureStore from "expo-secure-store";
import apiClient from "./api";
import { BACKEND_URL } from "./backend";
import { SERVER_SLOW_MESSAGE } from "./userFacingError";

class SocketService {
  private socket: Socket | null = null;
  private userRole: string | null = null;
  private pendingUserId: string | null = null;
  private lastKnownProviderLocation: {
    latitude: number;
    longitude: number;
  } | null = null;
  private eventListeners: Map<string, Set<Function>> = new Map(); // FIX #5: Track listeners for cleanup

  private readonly VALID_ROLES = new Set([
    "patient",
    "doctor",
    "nurse",
    "physiotherapist",
    "social worker",
    "pharmacist",
  ]);

  private normalizeRole(
    role?: string,
  ):
    | "patient"
    | "doctor"
    | "nurse"
    | "physiotherapist"
    | "social worker"
    | "pharmacist"
    | undefined {
    if (!role) return undefined;
    const normalizedRole = role.trim().toLowerCase();
    if (!this.VALID_ROLES.has(normalizedRole)) {
      return undefined;
    }
    return normalizedRole as
      | "patient"
      | "doctor"
      | "nurse"
      | "physiotherapist"
      | "social worker"
      | "pharmacist";
  }

  connect(
    userId: string,
    role?:
      | "patient"
      | "doctor"
      | "nurse"
      | "physiotherapist"
      | "social worker"
      | "pharmacist",
  ) {
    const normalizedRole = this.normalizeRole(role);
    this.pendingUserId = userId;

    if (this.socket?.connected) {
      if (
        normalizedRole &&
        (!this.userRole || this.userRole !== normalizedRole)
      ) {
        this.join(userId, normalizedRole, this.lastKnownProviderLocation);
      } else if (normalizedRole && this.lastKnownProviderLocation) {
        // Already joined — push fresh GPS so server hasLocation becomes true.
        this.syncProviderSocketLocation(this.lastKnownProviderLocation);
      }
      return this.socket;
    }

    if (this.socket && !this.socket.connected) {
      // Socket exists but is disconnected — refresh auth and reconnect
      void this.refreshAuthAndConnect(userId, normalizedRole, role);
      return this.socket;
    }

    this.socket = io(BACKEND_URL, {
      // Prefer websocket — polling often fails with "xhr poll error" on device networks.
      transports: ["websocket", "polling"],
      query: { userId },
      auth: {},
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    this.eventListeners.forEach((callbacks, event) => {
      callbacks.forEach((callback) => {
        this.socket?.on(event, callback as any);
      });
    });

    this.socket.on("connect", () => {
      if (normalizedRole) {
        this.join(userId, normalizedRole, this.lastKnownProviderLocation);
      } else {
        console.warn(
          "⚠️ Skipping socket join because role is missing or invalid. userId:",
          userId,
          "raw role:",
          role,
        );
      }
    });

    this.socket.on("connect_error", (error) => {
      console.error("❌ Socket connection error:", error.message);
    });

    this.socket.on("error", (error) => {
      console.error("❌ Socket error:", error);
    });

    void this.refreshAuthAndConnect(userId, normalizedRole, role);
    return this.socket;
  }

  private async refreshAuthAndConnect(
    userId: string,
    normalizedRole:
      | "patient"
      | "doctor"
      | "nurse"
      | "physiotherapist"
      | "social worker"
      | "pharmacist"
      | undefined,
    _rawRole?: string,
  ) {
    if (!this.socket) return;
    let authToken: string | null = null;
    try {
      authToken = await SecureStore.getItemAsync("authToken");
    } catch {
      authToken = null;
    }
    this.socket.auth = authToken ? { token: authToken } : {};
    (this.socket.io.opts.query as Record<string, string>) = { userId };
    if (!this.socket.connected) {
      this.socket.connect();
    } else if (normalizedRole) {
      this.join(userId, normalizedRole, this.lastKnownProviderLocation);
    }
  }

  // FIX #5: Clean up event listeners on disconnect to prevent memory leaks
  private setupDisconnectHandler() {
    this.eventListeners.forEach((callbacks, event) => {
      callbacks.forEach((callback) => {
        if (this.socket) {
          this.socket.off(event, callback as any);
        }
      });
    });
    this.eventListeners.clear();
  }

  /** Cache GPS so reconnect/join can include hasLocation immediately. */
  setLastKnownProviderLocation(
    location: { latitude: number; longitude: number } | null,
  ): void {
    if (
      location &&
      typeof location.latitude === "number" &&
      typeof location.longitude === "number" &&
      Number.isFinite(location.latitude) &&
      Number.isFinite(location.longitude)
    ) {
      this.lastKnownProviderLocation = {
        latitude: location.latitude,
        longitude: location.longitude,
      };
      return;
    }
    this.lastKnownProviderLocation = null;
  }

  // Join the socket with user role
  join(
    userId: string,
    role:
      | "patient"
      | "doctor"
      | "nurse"
      | "physiotherapist"
      | "social worker"
      | "pharmacist",
    providerLocation?: { latitude: number; longitude: number } | null,
  ) {
    if (!this.socket?.connected) {
      console.error("Socket not connected when trying to join");
      return;
    }

    const normalizedRole = this.normalizeRole(role);
    if (!normalizedRole) {
      console.error(
        "Invalid role provided to join. userId:",
        userId,
        "role:",
        role,
      );
      return;
    }

    const coords =
      providerLocation &&
      typeof providerLocation.latitude === "number" &&
      typeof providerLocation.longitude === "number"
        ? providerLocation
        : this.lastKnownProviderLocation;

    if (coords) {
      this.setLastKnownProviderLocation(coords);
    }

    this.userRole = normalizedRole;
    const payload: {
      userId: string;
      role: string;
      providerLocation?: { latitude: number; longitude: number };
    } = { userId, role: normalizedRole };
    if (coords) {
      payload.providerLocation = coords;
    }
    this.socket.emit("join", payload);
  }

  /**
   * Keep server-side socket.providerLocation fresh for newRequestAvailable.
   * Named separately from updateProviderLocation(requestId, ...) used during routes.
   */
  syncProviderSocketLocation(location: {
    latitude: number;
    longitude: number;
  }): void {
    this.setLastKnownProviderLocation(location);
    if (!this.socket?.connected) return;
    if (
      typeof location?.latitude !== "number" ||
      typeof location?.longitude !== "number"
    ) {
      return;
    }
    this.socket.emit("updateProviderLocation", {
      providerLocation: {
        latitude: location.latitude,
        longitude: location.longitude,
      },
    });
  }

  disconnect() {
    if (this.socket) {
      // FIX #5: Clean up listeners before disconnecting
      this.setupDisconnectHandler();
      this.socket.disconnect();
      this.socket = null;
      this.userRole = null;
    }
  }

  // FIX #5: Validate connection before operations
  ensureConnected(): boolean {
    if (!this.socket?.connected) {
      console.error("Socket not connected. Use connect() method first.");
      return false;
    }
    return true;
  }

  // Wait for socket to be connected
  async waitForConnection(maxWaitTime: number = 5000): Promise<void> {
    const startTime = Date.now();

    if (this.socket && !this.socket.connected) {
      try {
        this.socket.connect();
      } catch {
        // connect() may throw if already connecting — keep polling below
      }
    }

    while (!this.socket?.connected && Date.now() - startTime < maxWaitTime) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    if (!this.socket?.connected) {
      throw new Error(SERVER_SLOW_MESSAGE);
    }
  }

  /** Ensure socket exists and is connected before emitting critical actions. */
  async ensureReadyForEmit(maxWaitTime: number = 10000): Promise<Socket> {
    if (!this.socket) {
      throw new Error(
        "Connection not ready. Please go online and try again.",
      );
    }
    await this.waitForConnection(maxWaitTime);
    return this.socket;
  }

  getSocket() {
    return this.socket;
  }

  getRole() {
    return this.userRole;
  }

  // Patient request methods
  createRequest(requestData: {
    patientId: string;
    location: { latitude: number; longitude: number };
    ailmentCategory: string;
    ailmentCategoryId?: string;
    consultationMode?: "house_visit" | "video_consultation";
    paymentMethod: "wallet" | "cash" | "medical_aid";
    symptoms?: string;
    consultationCost: number;
    address?: {
      route: string;
      locality: string;
      administrative_area_level_1: string;
      coordinates: {
        latitude: number;
        longitude: number;
      };
    };
    preferredTime?: string;
    medicalAidDetails?: {
      medicalAidId: string;
      medicalAidTitle?: string;
      membershipNumber: string;
      mainMemberName: string;
      mainMemberId: string;
      residentialAddress: string;
      postalAddress?: {
        addressee: string;
        addressType: "po_box" | "private_bag" | "street";
        boxNumber?: string;
        bagNumber?: string;
        unitOrAdditional?: string;
        premises?: string;
        subLocality?: string;
        locality?: string;
        postOffice: string;
        postcode: string;
        country?: string;
      };
    };
  }) {
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) {
        console.error("Socket not connected when trying to create request");
        reject(
          new Error(
            "Socket not connected. Please check your internet connection.",
          ),
        );
        return;
      }

      // Build address object with proper GeoJSON format
      const addressCoordinates = requestData.address?.coordinates || {
        latitude: requestData.location.latitude,
        longitude: requestData.location.longitude,
      };

      if (!requestData.ailmentCategoryId) {
        reject(new Error("Please select a valid ailment before submitting."));
        return;
      }

      const payload = {
        // patientId is ignored server-side; identity comes from the JWT.
        patientId: requestData.patientId,
        ailmentCategory: requestData.ailmentCategory,
        ailmentCategoryId: requestData.ailmentCategoryId,
        consultationMode: requestData.consultationMode || "house_visit",
        paymentMethod: requestData.paymentMethod,
        symptoms: requestData.symptoms || "No symptoms provided",
        consultationCost: requestData.consultationCost,
        estimatedCost: requestData.consultationCost,
        preferredTime: requestData.preferredTime,
        ...(requestData.medicalAidDetails
          ? { medicalAidDetails: requestData.medicalAidDetails }
          : {}),
        address: {
          route: requestData.address?.route || "Patient Location",
          locality: requestData.address?.locality || "Current City",
          administrative_area_level_1:
            requestData.address?.administrative_area_level_1 ||
            "Current Province",
          coordinates: {
            type: "Point",
            coordinates: [
              addressCoordinates.longitude,
              addressCoordinates.latitude,
            ], // GeoJSON format: [longitude, latitude]
          },
        },
      };

      let isResolved = false;

      // Listen for success response event
      const successHandler = (response: any) => {
        if (isResolved) return;
        isResolved = true;

        this.socket?.off("requestCreated", successHandler);
        this.socket?.off("requestError", errorHandler);
        clearTimeout(timeout);
        resolve(response);
      };

      // Listen for error response event
      const errorHandler = (error: any) => {
        console.error("❌ Received requestError event:", error);
        if (isResolved) return;
        isResolved = true;

        this.socket?.off("requestCreated", successHandler);
        this.socket?.off("requestError", errorHandler);
        clearTimeout(timeout);

        // Better error message formatting
        const errorMessage =
          error.error || error.message || "Failed to create request";
        reject(new Error(errorMessage));
      };

      // Register listeners BEFORE emitting
      this.socket.on("requestCreated", successHandler);
      this.socket.on("requestError", errorHandler);

      // Set a timeout in case backend doesn't respond
      const timeout = setTimeout(() => {
        if (isResolved) return;
        isResolved = true;

        this.socket?.off("requestCreated", successHandler);
        this.socket?.off("requestError", errorHandler);
        console.error(
          "❌ Request timeout - backend did not respond within 10 seconds",
        );
        reject(
          new Error(
            SERVER_SLOW_MESSAGE,
          ),
        );
      }, 10000); // 10 second timeout

      // Emit the request to backend
      this.socket.emit("createRequest", payload);
    });
  }

  /**
   * Fetch the patient's consultation requests.
   * - No options → full list (legacy array) for home / waiting-room.
   * - With page/limit → `{ requests, pagination }` from the server.
   */
  getPatientRequests(
    patientId: string,
    options?: { page?: number; limit?: number; paginated?: boolean },
  ): Promise<
    | any[]
    | {
        requests: any[];
        pagination: {
          page: number;
          limit: number;
          total: number;
          totalPages: number;
          hasMore: boolean;
        };
      }
  > {
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) {
        reject(new Error("Socket not connected"));
        return;
      }

      const handlePatientRequests = (payload: any) => {
        this.socket?.off("patientRequests", handlePatientRequests);
        this.socket?.off("requestError", handleError);
        clearTimeout(timeout);
        resolve(payload);
      };

      const handleError = (error: any) => {
        this.socket?.off("patientRequests", handlePatientRequests);
        this.socket?.off("requestError", handleError);
        clearTimeout(timeout);
        console.error("❌ Socket error:", error);
        reject(
          new Error(error.error || error.message || "Failed to get requests"),
        );
      };

      const timeout = setTimeout(() => {
        this.socket?.off("patientRequests", handlePatientRequests);
        this.socket?.off("requestError", handleError);
        reject(new Error(SERVER_SLOW_MESSAGE));
      }, 10000);

      this.socket.on("patientRequests", handlePatientRequests);
      this.socket.on("requestError", handleError);

      const payload: Record<string, unknown> = { patientId };
      if (options?.page !== undefined) payload.page = options.page;
      if (options?.limit !== undefined) payload.limit = options.limit;
      if (options?.paginated) payload.paginated = true;
      this.socket.emit("getPatientRequests", payload);
    });
  }

  // Listen for request status updates
  onRequestUpdate(callback: (data: any) => void) {
    if (this.socket) {
      this.socket.on("requestUpdate", callback);
      // FIX #5: Track listener for cleanup on disconnect
      if (!this.eventListeners.has("requestUpdate")) {
        this.eventListeners.set("requestUpdate", new Set());
      }
      this.eventListeners.get("requestUpdate")?.add(callback);
    }
  }

  // Listen for request updated events
  onRequestUpdated(callback: (data: any) => void) {
    if (this.socket) {
      this.socket.on("requestUpdated", callback);
      // FIX #5: Track listener for cleanup on disconnect
      if (!this.eventListeners.has("requestUpdated")) {
        this.eventListeners.set("requestUpdated", new Set());
      }
      this.eventListeners.get("requestUpdated")?.add(callback);
    }
  }

  // Listen for new available requests
  onNewRequestAvailable(callback: (data: any) => void) {
    if (this.socket) {
      this.socket.on("newRequestAvailable", callback);
      // FIX #5: Track listener for cleanup on disconnect
      if (!this.eventListeners.has("newRequestAvailable")) {
        this.eventListeners.set("newRequestAvailable", new Set());
      }
      this.eventListeners.get("newRequestAvailable")?.add(callback);
    }
  }

  // Listen for request status changes (broadcast to all users)
  onRequestStatusChanged(callback: (data: any) => void) {
    if (this.socket) {
      this.socket.on("requestStatusChanged", callback);
      // FIX #5: Track listener for cleanup on disconnect
      if (!this.eventListeners.has("requestStatusChanged")) {
        this.eventListeners.set("requestStatusChanged", new Set());
      }
      this.eventListeners.get("requestStatusChanged")?.add(callback);
    }
  }

  // Listen for provider unavailable notifications
  onProviderUnavailable(callback: (data: any) => void) {
    if (this.socket) {
      this.socket.on("providerUnavailable", callback);
      // FIX #5: Track listener for cleanup on disconnect
      if (!this.eventListeners.has("providerUnavailable")) {
        this.eventListeners.set("providerUnavailable", new Set());
      }
      this.eventListeners.get("providerUnavailable")?.add(callback);
    }
  }

  // Listen for provider responses (ETA, location)
  onProviderResponse(callback: (data: any) => void) {
    if (this.socket) {
      this.socket.on("providerResponse", callback);
      // FIX #5: Track listener for cleanup on disconnect
      if (!this.eventListeners.has("providerResponse")) {
        this.eventListeners.set("providerResponse", new Set());
      }
      this.eventListeners.get("providerResponse")?.add(callback);
    }
  }

  // Provider methods — returns { requests, pagination }
  getAvailableRequests(
    providerId: string,
    providerLocation?: { latitude: number; longitude: number } | null,
    options?: { page?: number; limit?: number },
  ): Promise<{
    requests: any[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasMore: boolean;
    };
  }> {
    return new Promise((resolve, reject) => {
      const page = Math.max(1, options?.page ?? 1);
      const limit = Math.min(100, Math.max(1, options?.limit ?? 20));

      if (!this.socket?.connected) {
        console.error("❌ Socket not connected. Current state:", {
          socketExists: !!this.socket,
          isConnected: this.socket?.connected,
          socketId: this.socket?.id,
        });
        reject(new Error("Socket not connected"));
        return;
      }

      const normalizePayload = (payload: any) => {
        if (Array.isArray(payload)) {
          return {
            requests: payload,
            pagination: {
              page: 1,
              limit: payload.length || limit,
              total: payload.length,
              totalPages: payload.length > 0 ? 1 : 0,
              hasMore: false,
            },
          };
        }
        const requests = Array.isArray(payload?.requests)
          ? payload.requests
          : Array.isArray(payload?.data)
            ? payload.data
            : [];
        const pagination = payload?.pagination || {};
        return {
          requests,
          pagination: {
            page: Number(pagination.page) || page,
            limit: Number(pagination.limit) || limit,
            total: Number(pagination.total) || requests.length,
            totalPages: Number(pagination.totalPages) || 0,
            hasMore: Boolean(pagination.hasMore),
          },
        };
      };

      // Set up listener for the response event
      const handleAvailableRequests = (payload: any) => {
        // Clean up the listener
        this.socket?.off("availableRequests", handleAvailableRequests);
        clearTimeout(timeout);
        const normalized = normalizePayload(payload);
        resolve(normalized);
      };

      const handleError = (error: any) => {
        this.socket?.off("availableRequests", handleAvailableRequests);
        this.socket?.off("requestError", handleError);
        clearTimeout(timeout);
        console.error("❌ Socket error:", error);
        reject(
          new Error(
            error.error || error.message || "Failed to get available requests",
          ),
        );
      };

      // Set timeout to reject if no response
      const timeout = setTimeout(() => {
        this.socket?.off("availableRequests", handleAvailableRequests);
        this.socket?.off("requestError", handleError);
        console.error("❌ Request timeout - backend did not respond");
        reject(
          new Error(
            SERVER_SLOW_MESSAGE,
          ),
        );
      }, 10000);

      this.socket.on("availableRequests", handleAvailableRequests);
      this.socket.on("requestError", handleError);

      const payload = {
        providerId,
        page,
        limit,
        ...(providerLocation ? { providerLocation } : {}),
      };
      this.socket.emit("getAvailableRequests", payload);
    });
  }

  async acceptRequest(
    requestId: string,
    providerId: string,
    providerLocation?: { latitude: number; longitude: number } | null,
  ) {
    if (!requestId) {
      throw new Error("Missing consultation request id.");
    }

    const locationPayload =
      providerLocation &&
      typeof providerLocation.latitude === "number" &&
      typeof providerLocation.longitude === "number"
        ? {
            latitude: Number(providerLocation.latitude),
            longitude: Number(providerLocation.longitude),
          }
        : null;

    // Prefer HTTP — socket is often down (xhr poll error) while REST still works.
    try {
      console.log("📤 HTTP acceptRequest", {
        requestId,
        providerId,
        hasLocation: Boolean(locationPayload),
      });
      const response = await apiClient.post(
        `/app/requests/${encodeURIComponent(String(requestId))}/accept`,
        locationPayload ? { providerLocation: locationPayload } : {},
        { timeout: 30000 },
      );
      if (response.data?.request) {
        return response.data.request;
      }
      return response.data;
    } catch (httpError: any) {
      const status = httpError?.response?.status;
      const apiMessage =
        httpError?.response?.data?.message ||
        httpError?.response?.data?.error ||
        httpError?.message;

      // Endpoint missing on older servers — fall back to socket.
      if (status !== 404 && status !== 405) {
        console.error("❌ HTTP acceptRequest failed:", status, apiMessage);
        throw new Error(
          typeof apiMessage === "string" && apiMessage.trim()
            ? apiMessage
            : "Failed to accept request",
        );
      }
      console.warn(
        "⚠️ HTTP accept endpoint unavailable, falling back to socket",
        status,
      );
    }

    if (locationPayload) {
      try {
        this.syncProviderSocketLocation(locationPayload);
      } catch {
        // best effort
      }
    }

    const socket = await this.ensureReadyForEmit(10000);

    return new Promise((resolve, reject) => {
      let settled = false;
      const matchesRequest = (payload: any) => {
        const id =
          payload?._id?.toString?.() ||
          payload?._id ||
          payload?.requestId?.toString?.() ||
          payload?.requestId;
        return !id || String(id) === String(requestId);
      };

      const cleanup = () => {
        socket.off("requestUpdated", handleRequestUpdated);
        socket.off("acceptConfirmed", handleAcceptConfirmed);
        socket.off("requestError", handleError);
        clearTimeout(timeout);
      };

      const settleResolve = (value: any) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(value);
      };

      const settleReject = (error: Error) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(error);
      };

      const handleRequestUpdated = (request: any) => {
        if (!matchesRequest(request)) return;
        settleResolve(request);
      };

      const handleAcceptConfirmed = (data: any) => {
        if (!matchesRequest(data)) return;
        settleResolve(data);
      };

      const handleError = (error: any) => {
        const message = String(error?.error || error?.message || "");
        const errorRequestId =
          error?.requestId?.toString?.() || error?.requestId;
        if (errorRequestId && String(errorRequestId) !== String(requestId)) {
          return;
        }
        console.error("❌ Socket error on accept:", error);
        settleReject(new Error(message || "Failed to accept request"));
      };

      const timeout = setTimeout(() => {
        console.error(
          "❌ Accept request timeout - no response from backend within 15 seconds",
        );
        settleReject(new Error(SERVER_SLOW_MESSAGE));
      }, 15000);

      socket.on("requestUpdated", handleRequestUpdated);
      socket.on("acceptConfirmed", handleAcceptConfirmed);
      socket.on("requestError", handleError);

      const payload = {
        requestId: String(requestId),
        providerId: String(providerId),
        ...(locationPayload ? { providerLocation: locationPayload } : {}),
      };

      console.log("📤 Socket acceptRequest fallback", {
        requestId: payload.requestId,
        providerId: payload.providerId,
        hasLocation: Boolean(locationPayload),
        socketId: socket.id,
        connected: socket.connected,
      });
      socket.emit("acceptRequest", payload);
    });
  }

  getProviderRequests(providerId: string) {
    return new Promise((resolve, reject) => {

      if (!this.socket?.connected) {
        console.error("❌ Socket not connected. Current state:", {
          socketExists: !!this.socket,
          isConnected: this.socket?.connected,
          socketId: this.socket?.id,
        });
        reject(new Error("Socket not connected"));
        return;
      }

      // Set up listener for the response event
      const handleProviderRequests = (requests: any) => {
        // Clean up the listener
        this.socket?.off("providerRequests", handleProviderRequests);
        clearTimeout(timeout);
        if (Array.isArray(requests) && requests.length > 0) {
        }
        resolve(requests);
      };

      const handleError = (error: any) => {
        this.socket?.off("providerRequests", handleProviderRequests);
        this.socket?.off("requestError", handleError);
        clearTimeout(timeout);
        console.error("❌ Socket error:", error);
        reject(
          new Error(
            error.error || error.message || "Failed to get provider requests",
          ),
        );
      };

      // Set timeout to reject if no response
      const timeout = setTimeout(() => {
        this.socket?.off("providerRequests", handleProviderRequests);
        this.socket?.off("requestError", handleError);
        console.error("❌ Request timeout - backend did not respond");
        reject(
          new Error(
            SERVER_SLOW_MESSAGE,
          ),
        );
      }, 10000);

      this.socket.on("providerRequests", handleProviderRequests);
      this.socket.on("requestError", handleError);

      this.socket.emit("getProviderRequests", { providerId });
    });
  }

  rejectRequest(requestId: string, providerId: string) {
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) {
        reject(new Error("Socket not connected"));
        return;
      }

      const handleRequestHidden = (data: any) => {
        this.socket?.off("requestHidden", handleRequestHidden);
        this.socket?.off("requestError", handleError);
        clearTimeout(timeout);
        resolve(data);
      };

      const handleError = (error: any) => {
        this.socket?.off("requestHidden", handleRequestHidden);
        this.socket?.off("requestError", handleError);
        clearTimeout(timeout);
        console.error("❌ Socket error:", error);
        reject(
          new Error(error.error || error.message || "Failed to reject request"),
        );
      };

      const timeout = setTimeout(() => {
        this.socket?.off("requestHidden", handleRequestHidden);
        this.socket?.off("requestError", handleError);
        reject(
          new Error(
            SERVER_SLOW_MESSAGE,
          ),
        );
      }, 10000);

      this.socket.on("requestHidden", handleRequestHidden);
      this.socket.on("requestError", handleError);

      this.socket.emit("rejectRequest", { requestId, providerId });
    });
  }

  updateRequestStatus(
    requestId: string,
    providerId: string,
    status: string,
    location?: { latitude: number; longitude: number },
  ) {
    return new Promise((resolve, reject) => {
      if (!this.socket) return reject(new Error("Socket not connected"));

      const payload = {
        requestId,
        providerId, // This is the crucial addition
        status,
        providerLocation: location,
        hasLocation: !!location,
      };

      let resolved = false;
      const timeout = setTimeout(() => {
        if (!resolved) {
          this.socket?.off("requestUpdated", handleSuccess);
          this.socket?.off("requestError", handleError);
          resolved = true;
          reject(
            new Error(SERVER_SLOW_MESSAGE),
          );
        }
      }, 10000);

      const handleSuccess = (response: any) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timeout);
        this.socket?.off("requestUpdated", handleSuccess);
        this.socket?.off("requestError", handleError);
        resolve(response);
      };

      const handleError = (error: any) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timeout);
        this.socket?.off("requestUpdated", handleSuccess);
        this.socket?.off("requestError", handleError);
        console.error("❌ Socket error from updateRequestStatus:", error);
        reject(
          new Error(
            error.error || error.message || "Failed to update request status",
          ),
        );
      };

      this.socket.on("requestUpdated", handleSuccess);
      this.socket.on("requestError", handleError);

      this.socket.emit("updateRequestStatus", payload);
    });
  }

  confirmTeleconsultationPayment(requestId: string, userId: string) {
    return this.updateRequestStatus(
      requestId,
      userId,
      "provider_confirmation_pending",
    );
  }

  confirmTeleconsultationPaymentReceived(requestId: string, providerId: string) {
    return this.updateRequestStatus(requestId, providerId, "ready_for_call");
  }

  updateProviderResponse(
    requestId: string,
    eta: string,
    location: { latitude: number; longitude: number },
  ) {
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) {
        reject(new Error("Socket not connected"));
        return;
      }

      let resolved = false;

      const handleRequestUpdated = (response: any) => {
        if (!resolved) {
          resolved = true;
          this.socket?.off("requestUpdated", handleRequestUpdated);
          this.socket?.off("requestError", handleError);
          clearTimeout(timeout);
          resolve(response);
        }
      };

      const handleError = (error: any) => {
        if (!resolved) {
          resolved = true;
          this.socket?.off("requestUpdated", handleRequestUpdated);
          this.socket?.off("requestError", handleError);
          clearTimeout(timeout);
          console.error("❌ Error updating provider response:", error);
          reject(
            new Error(
              error.error ||
                error.message ||
                "Failed to update provider response",
            ),
          );
        }
      };

      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          this.socket?.off("requestUpdated", handleRequestUpdated);
          this.socket?.off("requestError", handleError);
          reject(new Error(SERVER_SLOW_MESSAGE));
        }
      }, 10000);

      this.socket.on("requestUpdated", handleRequestUpdated);
      this.socket.on("requestError", handleError);

      this.socket.emit("updateProviderResponse", {
        requestId,
        estimatedArrival: eta,
        providerLocation: location,
      });
    });
  }

  cancelRequest(
    requestId: string,
    cancelledBy: "provider" | "patient",
    reason: string,
  ) {
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) {
        reject(new Error("Socket not connected"));
        return;
      }

      const handleRequestUpdated = (data: any) => {
        this.socket?.off("requestUpdated", handleRequestUpdated);
        this.socket?.off("requestError", handleError);
        clearTimeout(timeout);
        resolve(data);
      };

      const handleError = (error: any) => {
        this.socket?.off("requestUpdated", handleRequestUpdated);
        this.socket?.off("requestError", handleError);
        clearTimeout(timeout);
        console.error("❌ Socket error:", error);
        reject(
          new Error(error.error || error.message || "Failed to cancel request"),
        );
      };

      const timeout = setTimeout(() => {
        this.socket?.off("requestUpdated", handleRequestUpdated);
        this.socket?.off("requestError", handleError);
        reject(
          new Error(
            SERVER_SLOW_MESSAGE,
          ),
        );
      }, 10000);

      this.socket.on("requestUpdated", handleRequestUpdated);
      this.socket.on("requestError", handleError);

      this.socket.emit("cancelRequest", { requestId, cancelledBy, reason });
    });
  }

  // Update provider location during route
  updateProviderLocation(
    requestId: string,
    providerId: string,
    coordinates: { latitude: number; longitude: number },
  ) {
    if (!this.socket?.connected) {
      console.error(
        "Socket not connected when trying to update provider location",
      );
      return;
    }

    this.socket.emit("updateProviderLocationRealtime", {
      requestId,
      location: coordinates,
    });
  }

  // Add event listeners (tracked so they survive reconnect / late connect)
  on(event: string, callback: (...args: any[]) => void) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  // Remove specific event listeners
  off(event: string, callback?: (...args: any[]) => void) {
    if (callback) {
      this.eventListeners.get(event)?.delete(callback);
      if (this.socket) {
        this.socket.off(event, callback);
      }
      return;
    }
    this.eventListeners.delete(event);
    if (this.socket) {
      this.socket.off(event);
    }
  }
}

export default new SocketService();

