// Socket.IO client for real-time communication with backend
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = 'http://192.168.11.95:4000';

class SocketService {
  private socket: Socket | null = null;
  private userRole: string | null = null;

  connect(userId: string, role?: 'patient' | 'doctor' | 'nurse' | 'physiotherapist' | 'social worker') {
    if (this.socket?.connected) {
      console.log('Socket already connected');
      return this.socket;
    }

    console.log('Connecting to socket with userId:', userId, 'role:', role);

    this.socket = io(SOCKET_URL, {
      transports: ['polling', 'websocket'],
      query: { userId },
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    this.socket.on('connect', () => {
      console.log('✅ Socket connected:', this.socket?.id);
      
      // Auto-join if role is provided
      if (role) {
        this.join(userId, role);
      }
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ Socket disconnected:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ Socket connection error:', error.message);
    });

    this.socket.on('error', (error) => {
      console.error('❌ Socket error:', error);
    });

    return this.socket;
  }

  // Join the socket with user role
  join(userId: string, role: 'patient' | 'doctor' | 'nurse' | 'physiotherapist' | 'social worker') {
    if (!this.socket?.connected) {
      console.error('Socket not connected when trying to join');
      return;
    }

    this.userRole = role;
    console.log('📤 Emitting join event with userId:', userId, 'role:', role);
    this.socket.emit('join', { userId, role });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.userRole = null;
    }
  }

  // Wait for socket to be connected
  async waitForConnection(maxWaitTime: number = 5000): Promise<void> {
    const startTime = Date.now();
    
    while (!this.socket?.connected && (Date.now() - startTime) < maxWaitTime) {
      console.log('⏳ Waiting for socket connection...');
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    if (!this.socket?.connected) {
      throw new Error(`Socket connection timeout after ${maxWaitTime}ms`);
    }
    
    console.log('✅ Socket is connected');
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
    paymentMethod: 'wallet' | 'cash';
    symptoms?: string;
    estimatedCost: number;
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
  }) {
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) {
        console.error('Socket not connected when trying to create request');
        reject(new Error('Socket not connected. Please check your internet connection.'));
        return;
      }

      // Prepare the data with address structure
      const payload = {
        patientId: requestData.patientId,
        ailmentCategory: requestData.ailmentCategory,
        ailmentCategoryId: requestData.ailmentCategoryId || '67455f1b8c8e9b5c3f2e1d6a', // Use a valid category ID or it will use this default
        paymentMethod: requestData.paymentMethod,
        symptoms: requestData.symptoms || 'No symptoms provided',
        estimatedCost: requestData.estimatedCost,
        preferredTime: requestData.preferredTime,
        address: requestData.address || {
          route: 'Patient Location',
          locality: 'Current City',
          administrative_area_level_1: 'Current Province',
          coordinates: {
            latitude: requestData.location.latitude,
            longitude: requestData.location.longitude,
          },
        },
      };

      console.log('📤 Emitting createRequest with payload:', JSON.stringify(payload, null, 2));

      let isResolved = false;

      // Listen for success response event
      const successHandler = (response: any) => {
        console.log('✅ Received requestCreated event:', response);
        if (isResolved) return;
        isResolved = true;
        
        this.socket?.off('requestCreated', successHandler);
        this.socket?.off('requestError', errorHandler);
        clearTimeout(timeout);
        resolve(response);
      };

      // Listen for error response event
      const errorHandler = (error: any) => {
        console.error('❌ Received requestError event:', error);
        if (isResolved) return;
        isResolved = true;
        
        this.socket?.off('requestCreated', successHandler);
        this.socket?.off('requestError', errorHandler);
        clearTimeout(timeout);
        
        // Better error message formatting
        const errorMessage = error.error || error.message || 'Failed to create request';
        reject(new Error(errorMessage));
      };

      // Register listeners BEFORE emitting
      this.socket.on('requestCreated', successHandler);
      this.socket.on('requestError', errorHandler);

      // Set a timeout in case backend doesn't respond
      const timeout = setTimeout(() => {
        if (isResolved) return;
        isResolved = true;
        
        this.socket?.off('requestCreated', successHandler);
        this.socket?.off('requestError', errorHandler);
        console.error('❌ Request timeout - backend did not respond within 10 seconds');
        reject(new Error('Request timeout - backend did not respond within 10 seconds'));
      }, 10000); // 10 second timeout

      // Emit the request to backend
      this.socket.emit('createRequest', payload);
    });
  }

  getPatientRequests(patientId: string) {
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) {
        reject(new Error('Socket not connected'));
        return;
      }

      const handlePatientRequests = (requests: any) => {
        this.socket?.off('patientRequests', handlePatientRequests);
        clearTimeout(timeout);
        console.log('✅ Received patientRequests event:', requests);
        resolve(requests);
      };

      const handleError = (error: any) => {
        this.socket?.off('patientRequests', handlePatientRequests);
        this.socket?.off('requestError', handleError);
        clearTimeout(timeout);
        console.error('❌ Socket error:', error);
        reject(new Error(error.error || error.message || 'Failed to get requests'));
      };

      const timeout = setTimeout(() => {
        this.socket?.off('patientRequests', handlePatientRequests);
        this.socket?.off('requestError', handleError);
        reject(new Error('Request timeout - backend did not respond within 10 seconds'));
      }, 10000);

      this.socket.on('patientRequests', handlePatientRequests);
      this.socket.on('requestError', handleError);

      console.log('📤 Emitting getPatientRequests with patientId:', patientId);
      this.socket.emit('getPatientRequests', { patientId });
    });
  }

  // Listen for request status updates
  onRequestUpdate(callback: (data: any) => void) {
    if (this.socket) {
      this.socket.on('requestUpdate', callback);
    }
  }

  // Listen for request updated events
  onRequestUpdated(callback: (data: any) => void) {
    if (this.socket) {
      this.socket.on('requestUpdated', callback);
    }
  }

  // Listen for new available requests
  onNewRequestAvailable(callback: (data: any) => void) {
    if (this.socket) {
      this.socket.on('newRequestAvailable', callback);
    }
  }

  // Listen for request status changes (broadcast to all users)
  onRequestStatusChanged(callback: (data: any) => void) {
    if (this.socket) {
      this.socket.on('requestStatusChanged', callback);
    }
  }

  // Listen for provider unavailable notifications
  onProviderUnavailable(callback: (data: any) => void) {
    if (this.socket) {
      this.socket.on('providerUnavailable', callback);
    }
  }

  // Listen for provider responses (ETA, location)
  onProviderResponse(callback: (data: any) => void) {
    if (this.socket) {
      this.socket.on('providerResponse', callback);
    }
  }

  // Provider methods
  getAvailableRequests(providerId: string) {
    return new Promise((resolve, reject) => {
      console.log('🔍 getAvailableRequests called with providerId:', providerId);
      console.log('🔍 Socket state:', {
        exists: !!this.socket,
        connected: this.socket?.connected,
        id: this.socket?.id
      });
      
      if (!this.socket?.connected) {
        console.error('❌ Socket not connected. Current state:', {
          socketExists: !!this.socket,
          isConnected: this.socket?.connected,
          socketId: this.socket?.id
        });
        reject(new Error('Socket not connected'));
        return;
      }

      // Set up listener for the response event
      const handleAvailableRequests = (requests: any) => {
        // Clean up the listener
        this.socket?.off('availableRequests', handleAvailableRequests);
        clearTimeout(timeout);
        console.log('✅ Received availableRequests event');
        console.log('📊 Requests data:', JSON.stringify(requests, null, 2));
        console.log('📊 Requests count:', Array.isArray(requests) ? requests.length : 'not an array');
        if (Array.isArray(requests) && requests.length > 0) {
          console.log('📊 First request:', JSON.stringify(requests[0], null, 2));
        }
        resolve(requests);
      };

      const handleError = (error: any) => {
        this.socket?.off('availableRequests', handleAvailableRequests);
        this.socket?.off('requestError', handleError);
        clearTimeout(timeout);
        console.error('❌ Socket error:', error);
        reject(new Error(error.error || error.message || 'Failed to get available requests'));
      };

      // Set timeout to reject if no response
      const timeout = setTimeout(() => {
        this.socket?.off('availableRequests', handleAvailableRequests);
        this.socket?.off('requestError', handleError);
        console.error('❌ Request timeout - backend did not respond');
        reject(new Error('Request timeout - backend did not respond within 10 seconds'));
      }, 10000);

      this.socket.on('availableRequests', handleAvailableRequests);
      this.socket.on('requestError', handleError);

      console.log('📤 Emitting getAvailableRequests with providerId:', providerId);
      this.socket.emit('getAvailableRequests', { providerId });
    });
  }

  acceptRequest(requestId: string, providerId: string) {
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) {
        console.error('❌ Socket not connected when trying to accept request');
        reject(new Error('Socket not connected'));
        return;
      }

      const handleRequestUpdated = (request: any) => {
        this.socket?.off('requestUpdated', handleRequestUpdated);
        this.socket?.off('requestError', handleError);
        clearTimeout(timeout);
        console.log('✅ Request accepted - full response:', JSON.stringify(request, null, 2));
        console.log('✅ Response _id:', request?._id);
        console.log('✅ Response status:', request?.status);
        console.log('✅ Response providerId:', request?.providerId);
        console.log('✅ Response patientId:', request?.patientId);
        console.log('✅ Response timeline:', request?.timeline);
        resolve(request);
      };

      const handleError = (error: any) => {
        this.socket?.off('requestUpdated', handleRequestUpdated);
        this.socket?.off('requestError', handleError);
        clearTimeout(timeout);
        console.error('❌ Socket error on accept:', error);
        reject(new Error(error.error || error.message || 'Failed to accept request'));
      };

      const timeout = setTimeout(() => {
        this.socket?.off('requestUpdated', handleRequestUpdated);
        this.socket?.off('requestError', handleError);
        console.error('❌ Accept request timeout - no response from backend within 10 seconds');
        reject(new Error('Request timeout - backend did not respond within 10 seconds'));
      }, 10000);

      this.socket.on('requestUpdated', handleRequestUpdated);
      this.socket.on('requestError', handleError);

      const payload = { requestId, providerId };
      console.log('📤 Emitting acceptRequest with payload:', JSON.stringify(payload, null, 2));
      console.log('📤 Payload requestId type:', typeof payload.requestId);
      console.log('📤 Payload providerId type:', typeof payload.providerId);
      this.socket.emit('acceptRequest', payload);
    });
  }

  getProviderRequests(providerId: string) {
    return new Promise((resolve, reject) => {
      console.log('🔍 getProviderRequests called with providerId:', providerId);
      console.log('🔍 Socket state:', {
        exists: !!this.socket,
        connected: this.socket?.connected,
        id: this.socket?.id
      });
      
      if (!this.socket?.connected) {
        console.error('❌ Socket not connected. Current state:', {
          socketExists: !!this.socket,
          isConnected: this.socket?.connected,
          socketId: this.socket?.id
        });
        reject(new Error('Socket not connected'));
        return;
      }

      // Set up listener for the response event
      const handleProviderRequests = (requests: any) => {
        // Clean up the listener
        this.socket?.off('providerRequests', handleProviderRequests);
        clearTimeout(timeout);
        console.log('✅ Received providerRequests event');
        console.log('📊 Provider requests data:', JSON.stringify(requests, null, 2));
        console.log('📊 Provider requests count:', Array.isArray(requests) ? requests.length : 'not an array');
        if (Array.isArray(requests) && requests.length > 0) {
          console.log('📊 First provider request:', JSON.stringify(requests[0], null, 2));
        }
        resolve(requests);
      };

      const handleError = (error: any) => {
        this.socket?.off('providerRequests', handleProviderRequests);
        this.socket?.off('requestError', handleError);
        clearTimeout(timeout);
        console.error('❌ Socket error:', error);
        reject(new Error(error.error || error.message || 'Failed to get provider requests'));
      };

      // Set timeout to reject if no response
      const timeout = setTimeout(() => {
        this.socket?.off('providerRequests', handleProviderRequests);
        this.socket?.off('requestError', handleError);
        console.error('❌ Request timeout - backend did not respond');
        reject(new Error('Request timeout - backend did not respond within 10 seconds'));
      }, 10000);

      this.socket.on('providerRequests', handleProviderRequests);
      this.socket.on('requestError', handleError);

      console.log('📤 Emitting getProviderRequests with providerId:', providerId);
      this.socket.emit('getProviderRequests', { providerId });
    });
  }

  rejectRequest(requestId: string, providerId: string) {
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) {
        reject(new Error('Socket not connected'));
        return;
      }

      const handleRequestHidden = (data: any) => {
        this.socket?.off('requestHidden', handleRequestHidden);
        this.socket?.off('requestError', handleError);
        clearTimeout(timeout);
        console.log('✅ Request rejected:', data);
        resolve(data);
      };

      const handleError = (error: any) => {
        this.socket?.off('requestHidden', handleRequestHidden);
        this.socket?.off('requestError', handleError);
        clearTimeout(timeout);
        console.error('❌ Socket error:', error);
        reject(new Error(error.error || error.message || 'Failed to reject request'));
      };

      const timeout = setTimeout(() => {
        this.socket?.off('requestHidden', handleRequestHidden);
        this.socket?.off('requestError', handleError);
        reject(new Error('Request timeout - backend did not respond within 10 seconds'));
      }, 10000);

      this.socket.on('requestHidden', handleRequestHidden);
      this.socket.on('requestError', handleError);

      console.log('📤 Emitting rejectRequest:', { requestId, providerId });
      this.socket.emit('rejectRequest', { requestId, providerId });
    });
  }

  updateRequestStatus(
    requestId: string,
    status: 'en_route' | 'arrived' | 'in_progress' | 'completed',
    location?: { latitude: number; longitude: number }
  ) {
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) {
        reject(new Error('Socket not connected'));
        return;
      }

      let resolved = false;

      const handleRequestUpdated = (response: any) => {
        if (!resolved) {
          resolved = true;
          this.socket?.off('requestUpdated', handleRequestUpdated);
          this.socket?.off('requestError', handleError);
          clearTimeout(timeout);
          console.log('✅ Request status updated successfully:', response);
          resolve(response);
        }
      };

      const handleError = (error: any) => {
        if (!resolved) {
          resolved = true;
          this.socket?.off('requestUpdated', handleRequestUpdated);
          this.socket?.off('requestError', handleError);
          clearTimeout(timeout);
          console.error('❌ Error updating request status:', error);
          reject(new Error(error.error || error.message || 'Failed to update request status'));
        }
      };

      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          this.socket?.off('requestUpdated', handleRequestUpdated);
          this.socket?.off('requestError', handleError);
          reject(new Error('Request timeout - backend did not respond'));
        }
      }, 10000);

      this.socket.on('requestUpdated', handleRequestUpdated);
      this.socket.on('requestError', handleError);

      const payload = {
        requestId,
        status,
        providerLocation: location ? {
          latitude: location.latitude,
          longitude: location.longitude,
        } : undefined,
      };
      
      console.log('📤 Emitting updateRequestStatus:', {
        ...payload,
        hasLocation: !!location,
        locationLatitude: location?.latitude,
        locationLongitude: location?.longitude,
      });
      
      this.socket.emit('updateRequestStatus', payload);
    });
  }

  updateProviderResponse(
    requestId: string,
    eta: string,
    location: { latitude: number; longitude: number }
  ) {
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) {
        reject(new Error('Socket not connected'));
        return;
      }

      let resolved = false;

      const handleRequestUpdated = (response: any) => {
        if (!resolved) {
          resolved = true;
          this.socket?.off('requestUpdated', handleRequestUpdated);
          this.socket?.off('requestError', handleError);
          clearTimeout(timeout);
          console.log('✅ Provider response updated successfully:', response);
          resolve(response);
        }
      };

      const handleError = (error: any) => {
        if (!resolved) {
          resolved = true;
          this.socket?.off('requestUpdated', handleRequestUpdated);
          this.socket?.off('requestError', handleError);
          clearTimeout(timeout);
          console.error('❌ Error updating provider response:', error);
          reject(new Error(error.error || error.message || 'Failed to update provider response'));
        }
      };

      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          this.socket?.off('requestUpdated', handleRequestUpdated);
          this.socket?.off('requestError', handleError);
          reject(new Error('Request timeout - backend did not respond'));
        }
      }, 10000);

      this.socket.on('requestUpdated', handleRequestUpdated);
      this.socket.on('requestError', handleError);

      this.socket.emit('updateProviderResponse', { 
        requestId, 
        estimatedArrival: eta, 
        providerLocation: location 
      });
    });
  }

  cancelRequest(requestId: string, cancelledBy: 'provider' | 'patient', reason: string) {
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) {
        reject(new Error('Socket not connected'));
        return;
      }

      const handleRequestUpdated = (data: any) => {
        this.socket?.off('requestUpdated', handleRequestUpdated);
        this.socket?.off('requestError', handleError);
        clearTimeout(timeout);
        console.log('✅ Request cancelled:', data);
        resolve(data);
      };

      const handleError = (error: any) => {
        this.socket?.off('requestUpdated', handleRequestUpdated);
        this.socket?.off('requestError', handleError);
        clearTimeout(timeout);
        console.error('❌ Socket error:', error);
        reject(new Error(error.error || error.message || 'Failed to cancel request'));
      };

      const timeout = setTimeout(() => {
        this.socket?.off('requestUpdated', handleRequestUpdated);
        this.socket?.off('requestError', handleError);
        reject(new Error('Request timeout - backend did not respond within 10 seconds'));
      }, 10000);

      this.socket.on('requestUpdated', handleRequestUpdated);
      this.socket.on('requestError', handleError);

      console.log('📤 Emitting cancelRequest:', { requestId, cancelledBy, reason });
      this.socket.emit('cancelRequest', { requestId, cancelledBy, reason });
    });
  }

  // Update provider location during route
  updateProviderLocation(
    requestId: string,
    providerId: string,
    coordinates: { latitude: number; longitude: number }
  ) {
    if (!this.socket?.connected) {
      console.error('Socket not connected when trying to update provider location');
      return;
    }

    console.log('📍 Emitting provider location update:', { requestId, providerId, coordinates });
    this.socket.emit('updateProviderLocationRealtime', {
      requestId,
      location: coordinates,
    });
  }

  // Remove specific event listeners
  off(event: string, callback?: (...args: any[]) => void) {
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }
}

export default new SocketService();
