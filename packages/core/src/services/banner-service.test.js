import { BannerService } from './banner-service';

let service;
beforeEach(() => { jest.useFakeTimers(); service = new BannerService(); });
afterEach(() => { service.destroy(); jest.useRealTimers(); jest.restoreAllMocks(); });

test('manual dismissal cancels its timer without duplicate notifications', () => {
  const listener = jest.fn();
  service.subscribe(listener);
  const id = service.showBanner({ message: 'Session expired', duration: 100 });
  service.dismissBanner(id);
  const count = listener.mock.calls.length;
  jest.advanceTimersByTime(1000);
  expect(listener).toHaveBeenCalledTimes(count);
  expect(service.getBanners()).toEqual([]);
  expect(jest.getTimerCount()).toBe(0);
});

test('a persistent session error survives timed banners and IDs remain unique', () => {
  const persistent = service.showBanner({ type: 'error', message: 'Session expired', duration: 0 });
  const transient = service.showBanner({ message: 'Connected' });
  expect(persistent).not.toBe(transient);
  jest.advanceTimersByTime(5000);
  expect(service.getBanners()).toEqual([expect.objectContaining({ id: persistent, type: 'error' })]);
  expect(jest.getTimerCount()).toBe(0);
});

test('destroy cancels every timer and removes subscriptions', () => {
  const listener = jest.fn();
  service.subscribe(listener);
  service.showBanner({ message: 'First' });
  service.showBanner({ message: 'Second', duration: 100 });
  service.destroy();
  const count = listener.mock.calls.length;
  jest.runAllTimers();
  service.showBanner({ message: 'New lifecycle', duration: 0 });
  expect(listener).toHaveBeenCalledTimes(count);
  expect(jest.getTimerCount()).toBe(0);
});

test('one failing subscriber does not prevent other subscribers receiving updates', () => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  service.subscribe((banners) => { if (banners.length) throw new Error('UI failed'); });
  const healthy = jest.fn();
  const unsubscribe = service.subscribe(healthy);
  expect(() => service.showBanner({ message: 'Session expired', duration: 0 })).not.toThrow();
  expect(healthy).toHaveBeenLastCalledWith([expect.objectContaining({ message: 'Session expired' })]);
  unsubscribe();
  service.clearAllBanners();
  expect(healthy).toHaveBeenCalledTimes(2);
});
