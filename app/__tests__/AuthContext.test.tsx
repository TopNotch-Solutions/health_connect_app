import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { AuthProvider, useAuth } from '../../context/AuthContext';
import apiClient from '../../lib/api';
import * as SecureStore from 'expo-secure-store';

// Explicit, stable mocks matching module resolution
jest.mock('../../lib/api', () => ({
  __esModule: true,
  default: { post: jest.fn() },
}));
jest.mock('expo-secure-store');
jest.mock('../../lib/socket', () => ({
  __esModule: true,
  default: { disconnect: jest.fn() },
}));

describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Arrange: default SecureStore mocks
    (SecureStore.getItemAsync as unknown as jest.Mock).mockResolvedValue(null);
    (SecureStore.setItemAsync as unknown as jest.Mock).mockResolvedValue(undefined);
    (SecureStore.deleteItemAsync as unknown as jest.Mock).mockResolvedValue(undefined);
  });

  it('should initialize with no user', async () => {
    // Arrange: defaults already set in beforeEach

    // Act
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Assert
    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('should login successfully', async () => {
    // Arrange
    const mockUser = {
      userId: '123',
      email: 'test@example.com',
      fullname: 'Test User',
      role: 'patient' as const,
    };
    (apiClient.post as unknown as jest.Mock).mockResolvedValue({ data: { user: mockUser } });

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Act
    await act(async () => {
      await result.current.login('test@example.com', 'password123');
    });

    // Assert
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user?.email).toBe('test@example.com');
  });

  it('should handle login failure', async () => {
    // Arrange
    (apiClient.post as unknown as jest.Mock).mockRejectedValue({
      response: { data: { message: 'Invalid credentials' } },
    });

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Act & Assert (exception)
    await expect(
      act(async () => {
        await result.current.login('test@example.com', 'wrongpassword');
      })
    ).rejects.toMatchObject({ response: { data: { message: 'Invalid credentials' } } });

    // Assert
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('should logout successfully', async () => {
    // Arrange
    const mockUser = {
      userId: '123',
      email: 'test@example.com',
      fullname: 'Test User',
      role: 'patient' as const,
    };
    (apiClient.post as unknown as jest.Mock).mockResolvedValue({ data: { user: mockUser } });

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.login('test@example.com', 'password123');
    });

    // Act
    await act(async () => {
      await result.current.logout();
    });

    // Assert
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it('should update user successfully', async () => {
    // Arrange
    const mockUser = {
      userId: '123',
      email: 'test@example.com',
      fullname: 'Test User',
      role: 'patient' as const,
      balance: 100,
    };
    (apiClient.post as unknown as jest.Mock).mockResolvedValue({ data: { user: mockUser } });

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.login('test@example.com', 'password123');
    });

    // Act
    await act(async () => {
      await result.current.updateUser({ balance: 200 });
    });

    // Assert
    expect(result.current.user?.balance).toBe(200);
  });
});
