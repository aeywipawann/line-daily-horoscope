import "express-session";

declare module "express-session" {
  interface SessionData {
    adminAuthenticated?: boolean;
    csrfToken?: string;
  }
}
