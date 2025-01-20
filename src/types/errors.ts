export class WebGeneratorError extends Error {
  constructor(
    message: string,
    public readonly step: string,
    public readonly originalError?: any
  ) {
    super(message);
    this.name = 'WebGeneratorError';
  }
} 