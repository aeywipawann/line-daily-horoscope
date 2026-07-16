import { randomBytes, timingSafeEqual } from "node:crypto";
import { Router, type Request, type Response, type NextFunction } from "express";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import type { AppConfig } from "./config.js";
import type { Repository } from "./repositories.js";
import { zodiacKeys } from "./types.js";
import { zodiacThai } from "./zodiac.js";

const horoscopeSchema = z.object({
  horoscopeDate: z.string().date(),
  zodiacSign: z.enum(zodiacKeys),
  overview: z.string().trim().min(1).max(800),
  career: z.string().trim().min(1).max(800),
  finance: z.string().trim().min(1).max(800),
  love: z.string().trim().min(1).max(800),
  health: z.string().trim().min(1).max(800),
  luckyColor: z.string().trim().min(1).max(100),
  luckyNumber: z.string().trim().min(1).max(100),
  advice: z.string().trim().min(1).max(800),
  status: z.enum(["draft", "published"]),
});

export function createAdminRouter(repository: Repository, config: AppConfig): Router {
  const router = Router();
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: "ลองเข้าสู่ระบบหลายครั้งเกินไป กรุณารอ 15 นาที",
  });

  router.get("/login", (req, res) => {
    if (req.session.adminAuthenticated) return res.redirect("/admin");
    res.render("login", { error: null, csrfToken: csrfToken(req) });
  });

  router.post("/login", loginLimiter, verifyCsrf, async (req, res) => {
    const usernameMatches = safeStringEqual(String(req.body.username), config.ADMIN_USERNAME);
    const passwordMatches = await bcrypt.compare(
      String(req.body.password),
      config.ADMIN_PASSWORD_HASH,
    );
    if (!usernameMatches || !passwordMatches) {
      return res.status(401).render("login", {
        error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง",
        csrfToken: csrfToken(req),
      });
    }
    req.session.regenerate((error) => {
      if (error) return res.status(500).send("ไม่สามารถสร้าง session ได้");
      req.session.adminAuthenticated = true;
      req.session.csrfToken = randomBytes(32).toString("hex");
      res.redirect("/admin");
    });
  });

  router.use(requireAdmin);

  router.post("/logout", verifyCsrf, (req, res) => {
    req.session.destroy(() => res.redirect("/admin/login"));
  });

  router.get("/", async (req, res) => {
    const date = typeof req.query.date === "string" ? req.query.date : undefined;
    const horoscopes = await repository.listHoroscopes(date);
    res.render("admin-list", {
      horoscopes,
      zodiacThai,
      date: date ?? "",
      csrfToken: csrfToken(req),
    });
  });

  router.get("/horoscopes/new", (req, res) => {
    res.render("admin-form", {
      horoscope: null,
      zodiacKeys,
      zodiacThai,
      error: null,
      csrfToken: csrfToken(req),
    });
  });

  router.get("/horoscopes/:id/edit", async (req, res) => {
    const horoscope = await repository.getHoroscope(String(req.params.id));
    if (!horoscope) return res.status(404).send("ไม่พบคำทำนาย");
    res.render("admin-form", {
      horoscope,
      zodiacKeys,
      zodiacThai,
      error: null,
      csrfToken: csrfToken(req),
    });
  });

  router.post("/horoscopes/save", verifyCsrf, async (req, res) => {
    const parsed = horoscopeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).render("admin-form", {
        horoscope: req.body,
        zodiacKeys,
        zodiacThai,
        error: "กรุณากรอกข้อมูลทุกช่องให้ถูกต้อง",
        csrfToken: csrfToken(req),
      });
    }
    await repository.upsertHoroscope(parsed.data);
    res.redirect(`/admin?date=${encodeURIComponent(parsed.data.horoscopeDate)}`);
  });

  router.post("/horoscopes/:id/status", verifyCsrf, async (req, res) => {
    const status = z.enum(["draft", "published"]).safeParse(req.body.status);
    if (!status.success) return res.status(400).send("สถานะไม่ถูกต้อง");
    await repository.setHoroscopeStatus(String(req.params.id), status.data);
    res.redirect("/admin");
  });

  return router;
}

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.adminAuthenticated) {
    res.redirect("/admin/login");
    return;
  }
  next();
}

function csrfToken(req: Request): string {
  if (!req.session.csrfToken) req.session.csrfToken = randomBytes(32).toString("hex");
  return req.session.csrfToken;
}

function verifyCsrf(req: Request, res: Response, next: NextFunction): void {
  const expected = req.session.csrfToken;
  const actual = typeof req.body._csrf === "string" ? req.body._csrf : "";
  if (!expected || !safeStringEqual(actual, expected)) {
    res.status(403).send("CSRF token ไม่ถูกต้อง");
    return;
  }
  next();
}

function safeStringEqual(actual: string, expected: string): boolean {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}
