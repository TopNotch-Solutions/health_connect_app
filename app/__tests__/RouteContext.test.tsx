import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { RouteProvider, useRoute } from '../../context/RouteContext';

describe('RouteContext', () => {
  const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <RouteProvider>{children}</RouteProvider>
  );

  it('throws when used outside provider', () => {
    expect(() => renderHook(() => useRoute())).toThrow('useRoute must be used within a RouteProvider');
  });

  it('startRoute sets activeRoute', () => {
    const { result } = renderHook(() => useRoute(), { wrapper });

    const request = { _id: 'req-1' } as any;

    act(() => {
      result.current.startRoute(request);
    });

    expect(result.current.activeRoute?._id).toBe('req-1');
  });

  it('clearRoute resets activeRoute to null', () => {
    const { result } = renderHook(() => useRoute(), { wrapper });

    const request = { _id: 'req-2' } as any;

    act(() => {
      result.current.startRoute(request);
    });
    expect(result.current.activeRoute?._id).toBe('req-2');

    act(() => {
      result.current.clearRoute();
    });
    expect(result.current.activeRoute).toBeNull();
  });
});
