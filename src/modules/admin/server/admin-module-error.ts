export class AdminModuleValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminModuleValidationError";
  }
}
