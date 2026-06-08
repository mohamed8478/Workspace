/**
 * User Search Result Model
 * Minimal user data returned from contact search
 */
export interface UserSearchResult {
  readonly id: number;
  readonly username?: string;
  readonly firstName?: string;
  readonly lastName?: string;
  readonly fullName?: string;
  readonly email?: string;
}
