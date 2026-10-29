/**
 * Password policy. Deliberately simple: a minimum and maximum length,
 * enforced in constant work before hashing. No composition rules
 * (digits, symbols, mixed case) because those weaken real-world
 * strength more than they help, per the current NIST guidance.
 *
 * The upper bound of 128 characters protects the argon2 implementation
 * against adversarial very-long inputs; the lower bound of 12 is a
 * compromise between zero-cost usability and offline-guess resistance
 * for the owner's expected traffic.
 */
export class PasswordPolicy {
  public static readonly MIN_LENGTH = 12;
  public static readonly MAX_LENGTH = 128;

  private constructor() {
    // utility class; never instantiated
  }

  /**
   * Return `true` iff `password` is within the length bounds. The
   * value is not inspected further so callers must still enforce the
   * ban on logging or echoing it.
   */
  public static isAcceptable(password: string): boolean {
    const length = password.length;
    return length >= PasswordPolicy.MIN_LENGTH && length <= PasswordPolicy.MAX_LENGTH;
  }
}
