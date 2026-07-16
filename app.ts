import path from "node:path";
import express, { type Express } from "express";
import helmet from "helmet";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import type pg from "pg";
import type { AppConfig } from "./config.js";
import { createAdminRouter } from "./admin.js";
import type { Repository } from "./repositories.js";
import type { WebhookService, WebhookBody } from "./webhook-service.js";
import { verifyLineSignature } from "./signature.js";

export function createApp(
  config: AppConfig,
  pool: pg.Pool,
  repository: Repository,
  webhookService: WebhookService,
): Express {
  const app = express();
  app.set("trust proxy", 1);
  app.set("view engine", "ejs");
  app.set("views", path.join(process.cwd(), "views"));

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          "script-src": ["'self'"],
          "style-src": ["'self'", "'unsafe-inline'"],
        },
      },
    }),
  );

  app.get("/health", async (_req, res) => {
    try {
      await pool.query("SELECT 1");
      res.json({ ok: true });
    } catch {
      res.status(503).json({ ok: false });
    }
  });

  app.post(
    "/webhook",
    express.raw({ type: "application/json", limit: "1mb" }),
    async (req, res, next) => {
      const rawBody = req.body as Buffer;
      const signature = req.header("x-line-signature");
      if (!verifyLineSignature(rawBody, signature, config.LINE_CHANNEL_SECRET)) {
        res.status(401).json({ error: "invalid signature" });
        return;
      }
      try {
        const body = JSON.parse(rawBody.toString("utf8")) as WebhookBody;
        if (!Array.isArray(body.events)) {
          res.status(400).json({ error: "invalid webhook body" });
          return;
        }
        await webhookService.handle(body);
        res.sendStatus(200);
      } catch (error) {
        next(error);
      }
    },
  );

  const PgSession = connectPgSimple(session);
  app.use(express.urlencoded({ extended: false, limit: "100kb" }));
  app.use(
    session({
      store: new PgSession({ pool, tableName: "session" }),
      name: "horoscope_admin",
      secret: config.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        httpOnly: true,
        secure: config.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 8 * 60 * 60 * 1000,
      },
    }),
  );
  app.use("/admin", createAdminRouter(repository, config));

  app.use(
    (
      error: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      void _next;
      console.error(error);
      res.status(500).send("เกิดข้อผิดพลาดภายในระบบ");
    },
  );

  return app;
}
