describe('logger.js', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    jest.resetModules();
  });

  describe('development mode', () => {
    let logger;

    beforeEach(() => {
      process.env.NODE_ENV = 'development';
      jest.resetModules();
      jest.mock('@sentry/browser', () => ({
        captureException: jest.fn(),
        captureMessage: jest.fn(),
      }));
      logger = require('../logger').logger;
    });

    it('should log errors to console', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      logger.error('test error');
      expect(consoleSpy).toHaveBeenCalledWith('[ERROR] test error');
      consoleSpy.mockRestore();
    });

    it('should log warnings to console', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      logger.warn('test warning');
      expect(consoleSpy).toHaveBeenCalledWith('[WARN] test warning');
      consoleSpy.mockRestore();
    });

    it('should log info to console', () => {
      const consoleSpy = jest.spyOn(console, 'info').mockImplementation();
      logger.info('test info');
      expect(consoleSpy).toHaveBeenCalledWith('[INFO] test info');
      consoleSpy.mockRestore();
    });

    it('should log debug to console', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      logger.debug('test debug');
      expect(consoleSpy).toHaveBeenCalledWith('[DEBUG] test debug');
      consoleSpy.mockRestore();
    });

    it('should pass extra args to console', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      logger.error('test', { key: 'value' });
      expect(consoleSpy).toHaveBeenCalledWith('[ERROR] test', { key: 'value' });
      consoleSpy.mockRestore();
    });
  });

  describe('production mode', () => {
    let logger;
    let Sentry;

    beforeEach(() => {
      process.env.NODE_ENV = 'production';
      jest.resetModules();
      jest.mock('@sentry/browser', () => ({
        captureException: jest.fn(),
        captureMessage: jest.fn(),
      }));
      Sentry = require('@sentry/browser');
      logger = require('../logger').logger;
    });

    it('should send errors to Sentry', () => {
      logger.error('production error');
      expect(Sentry.captureException).toHaveBeenCalled();
    });

    it('should send Error instances to Sentry', () => {
      const err = new Error('actual error');
      logger.error(err);
      expect(Sentry.captureException).toHaveBeenCalledWith(err, undefined);
    });

    it('should send warnings to Sentry', () => {
      logger.warn('production warning');
      expect(Sentry.captureMessage).toHaveBeenCalledWith(
        'production warning',
        expect.objectContaining({ level: 'warning' })
      );
    });

    it('should not log info in production', () => {
      const consoleSpy = jest.spyOn(console, 'info').mockImplementation();
      logger.info('production info');
      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should not log debug in production', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      logger.debug('production debug');
      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});
