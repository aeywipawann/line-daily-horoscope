# LINE OA ดูดวงรายวัน

ระบบ LINE Official Account ภาษาไทยสำหรับดูดวงรายวันจากข้อมูลที่ผู้ดูแลเตรียมไว้ ใช้ Node.js, TypeScript, Express และ PostgreSQL มี Rich Menu, Quick Reply, Flex Message และหน้า Admin ที่รองรับ Draft/Published

> คำทำนายนี้จัดทำขึ้นเพื่อความบันเทิงและเป็นแนวทางทั่วไปเท่านั้น

## Architecture

```text
LINE user
   │ Rich Menu / Quick Reply / Postback
   ▼
POST /webhook
   ├─ ตรวจ x-line-signature จาก raw body
   ├─ claim webhookEventId ป้องกัน redelivery ซ้ำ
   ├─ per-user rate limit ใน PostgreSQL
   ├─ อ่านราศี/วันเกิดและ Published horoscope
   └─ ตอบ LINE Reply API ด้วย Flex Message

Admin browser ── session + CSRF ── /admin ── PostgreSQL
```

เลือก Render Web Service แทน Vercel Serverless เพราะ Express webhook, PostgreSQL session และหน้า Admin ทำงานเป็นบริการเดียวได้ตรงไปตรงมา มี health check และ pre-deploy migration ใน `render.yaml` ระบบใช้เวลา `Asia/Bangkok` ในการเลือกวันที่คำทำนายเสมอ

`HoroscopeProvider` เป็นขอบเขตสำหรับแหล่งคำทำนาย เวอร์ชันนี้ใช้ `CuratedHoroscopeProvider` ซึ่งอ่านเฉพาะรายการ Published และใช้ข้อความสำรองเมื่อวันนั้นไม่มีข้อมูล ในอนาคตสามารถเพิ่ม AI provider ที่ผ่าน moderation/safety review โดยไม่เปลี่ยน webhook หรือ Flex renderer

## สิ่งที่ระบบเก็บ

- LINE user ID
- ราศี และวันเกิดเมื่อผู้ใช้เลือกกรอก
- เวลาใช้งานล่าสุด
- ประวัติประเภทการขอดูดวง, ราศี และเวลา โดยไม่เก็บข้อความสนทนาหรือข้อมูลละเอียดอ่อนอื่น
- webhook event ID สำหรับกันข้อความซ้ำ

ผู้ใช้พิมพ์ `เปลี่ยนราศี` หรือกดปุ่มใน Flex Message เพื่อเปลี่ยนข้อมูล และพิมพ์ `ลบข้อมูล` เพื่อยืนยันลบราศี วันเกิด และประวัติทั้งหมดแบบ cascade

## ความต้องการของระบบ

- Node.js 20 ขึ้นไป
- PostgreSQL 14 ขึ้นไป หรือ Supabase PostgreSQL
- LINE Official Account ที่มี Messaging API channel
- URL HTTPS สาธารณะสำหรับ production

## ติดตั้งในเครื่อง

1. ติดตั้ง dependencies

   ```bash
   npm install
   ```

2. คัดลอก environment template

   ```bash
   cp .env.example .env
   ```

3. กรอกค่าต่อไปนี้ใน `.env`

   - `LINE_CHANNEL_SECRET`: Channel secret จาก LINE Developers Console
   - `LINE_CHANNEL_ACCESS_TOKEN`: long-lived channel access token
   - `DATABASE_URL`: PostgreSQL connection string
   - `DATABASE_SSL=true`: ใช้กับฐานข้อมูล production ที่บังคับ TLS; local ปกติใช้ `false`
   - `SESSION_SECRET`: ค่าสุ่มอย่างน้อย 32 bytes สร้างได้ด้วย `openssl rand -base64 48`
   - `ADMIN_USERNAME`: ชื่อผู้ดูแล
   - `ADMIN_PASSWORD_HASH`: bcrypt hash ห้ามใส่รหัสผ่าน plain text
   - `APP_BASE_URL`: URL ของบริการ เช่น `https://your-app.onrender.com`

4. สร้าง password hash

   ```bash
   npm run admin:hash-password -- "รหัสผ่านยาวและคาดเดายาก"
   ```

   นำผลลัพธ์ไปใส่ `ADMIN_PASSWORD_HASH`

5. สร้าง schema และข้อมูลตัวอย่าง 12 ราศีสำหรับวันที่ปัจจุบันตามเวลาไทย

   ```bash
   npm run db:migrate
   npm run db:seed
   ```

6. เริ่ม development server

   ```bash
   npm run dev
   ```

   - Webhook: `http://localhost:3000/webhook`
   - Admin: `http://localhost:3000/admin`
   - Health check: `http://localhost:3000/health`

สำหรับทดสอบ webhook จาก LINE ในเครื่อง ต้องใช้ HTTPS tunnel ที่เชื่อถือได้ และตั้ง webhook URL เป็น URL ของ tunnel ตามด้วย `/webhook`

## Database และ migrations

Migration อยู่ใน `migrations/001_initial.sql` และ runner อยู่ที่ `scripts/migrate.ts` ตารางหลัก:

- `users`: โปรไฟล์ขั้นต่ำ
- `horoscope_requests`: ประวัติการขอแบบไม่เก็บเนื้อหาสนทนา
- `horoscopes`: ข้อมูลคำทำนายและสถานะ Draft/Published
- `processed_webhook_events`: idempotency พร้อม retry lock
- `user_rate_limits`: จำกัดการกดถี่แบบ atomic
- `session`: server-side Admin sessions

Migration runner บันทึกไฟล์ที่ใช้แล้วใน `schema_migrations` และรันแต่ละไฟล์ใน transaction ห้ามแก้ migration ที่ deploy แล้ว ให้เพิ่มไฟล์ลำดับถัดไป เช่น `002_add_column.sql`

ข้อมูลตัวอย่างอยู่ใน `seeds/horoscopes.json` คำสั่ง seed เป็น upsert จึงรันซ้ำได้โดยไม่สร้างข้อมูลซ้ำ

## ตั้งค่า LINE Developers Console

1. สร้าง LINE Official Account และ Messaging API channel ตามคู่มือ [Build a bot](https://developers.line.biz/en/docs/messaging-api/building-bot/)
2. ที่แท็บ **Messaging API** ออก Channel access token และนำไปตั้งเป็น secret environment variable
3. คัดลอก Channel secret ไปตั้งเป็น `LINE_CHANNEL_SECRET`
4. ตั้ง Webhook URL เป็น `https://<your-domain>/webhook`
5. เปิด **Use webhook** แล้วกด **Verify** ระบบรองรับ verification body ที่มี `events: []`
6. แนะนำให้เปิด **Webhook redelivery** ระบบใช้ `webhookEventId` ป้องกัน event ซ้ำตามแนวทาง [Receive webhook events](https://developers.line.biz/en/docs/messaging-api/receiving-messages/)
7. ปิด Greeting message และ Auto-response ใน LINE Official Account Manager หากไม่ต้องการข้อความซ้ำกับ bot
8. เพิ่ม OA เป็นเพื่อน แล้วทดสอบเมนู, วันเกิด, 12 ราศี, เปลี่ยนราศี และลบข้อมูล

เซิร์ฟเวอร์ตรวจ `x-line-signature` กับ raw request body ก่อน parse เสมอ ห้ามวาง middleware ที่เปลี่ยน body ไว้ก่อน route `/webhook`

## Rich Menu

ไฟล์:

- `rich-menu/rich-menu.json`: พื้นที่กด 6 เมนู
- `rich-menu/rich-menu.png`: ภาพพร้อมอัปโหลด ขนาด 2500×1686
- `rich-menu/rich-menu.svg`: ต้นฉบับที่แก้ไขได้
- `scripts/create-rich-menu.ts`: สร้าง อัปโหลดภาพ และตั้งเป็น default

หลังตั้ง token แล้วรัน:

```bash
npm run richmenu:create
```

คำสั่งนี้เรียก Rich Menu API จริงและตั้งเมนูเป็น default สำหรับผู้ใช้ทั้งหมด ดูข้อกำหนดเพิ่มเติมที่ [Messaging API reference](https://developers.line.biz/en/reference/messaging-api/#rich-menu)

Quick Reply ใช้ 13 ปุ่มพอดี: วันเกิด 1 ปุ่มและ 12 ราศี ตัวอย่างย่ออยู่ใน `examples/quick-reply.json`; LINE รองรับสูงสุด 13 ปุ่มตาม [Quick Reply documentation](https://developers.line.biz/en/docs/messaging-api/using-quick-reply/) ส่วน Flex ตัวอย่างอยู่ใน `examples/flex-message.json` และตัวที่ใช้งานจริงสร้างจาก `src/messages.ts`

## หน้า Admin

เข้า `/admin` แล้วล็อกอินด้วย `ADMIN_USERNAME` และรหัสผ่านต้นฉบับของ hash ระบบมี:

- เพิ่มและแก้ไขคำทำนายแยกตามวันที่/ราศี
- Draft และ Published
- กรองรายการตามวันที่
- unique constraint ป้องกันคำทำนายซ้ำในวันและราศีเดียวกัน
- session เก็บใน PostgreSQL, cookie แบบ HttpOnly/SameSite และ Secure ใน production
- CSRF token ทุกคำสั่งที่เปลี่ยนข้อมูล
- จำกัดการลองล็อกอิน 10 ครั้งต่อ 15 นาที

ไม่มี route Admin ใดเชื่อมจาก LINE user ID และผู้ใช้ทั่วไปที่ไม่มี session จะถูกส่งไปหน้า login

## Deploy บน Render

วิธีที่แนะนำ:

1. นำ repository ขึ้น Git provider
2. ใน Render เลือก **New > Blueprint** แล้วเลือก repository นี้ ระบบจะอ่าน `render.yaml`
3. ตั้ง secret environment variables ที่ระบุ `sync: false`:
   - `LINE_CHANNEL_SECRET`
   - `LINE_CHANNEL_ACCESS_TOKEN`
   - `ADMIN_USERNAME`
   - `ADMIN_PASSWORD_HASH`
   - `APP_BASE_URL`
4. Render สร้าง PostgreSQL และตั้ง `DATABASE_URL`; `SESSION_SECRET` ถูกสุ่มจาก blueprint
5. Build command คือ `npm ci && npm run build`
6. Pre-deploy command รัน `npm run db:migrate`
7. Start command รัน `npm start`
8. หลัง deploy ให้นำ URL ไปตั้ง webhook และตั้ง `APP_BASE_URL`
9. รัน seed หนึ่งครั้งผ่าน Render Shell:

   ```bash
   npm run db:seed
   ```

10. สร้าง Rich Menu ผ่าน Render Shell หรือเครื่อง local ที่ตั้ง token แล้ว

Render ต้องการให้ web service bind กับ `PORT` และ `0.0.0.0` ซึ่งโค้ดรองรับแล้ว และ blueprint ตั้ง `/health` เป็น health check ดู [Render Node/Express guide](https://render.com/docs/deploy-node-express-app) และ [Health checks](https://render.com/docs/health-checks)

### ใช้ Supabase แทน Render Postgres

สร้าง Supabase project, นำ PostgreSQL connection string มาใส่ `DATABASE_URL`, ตั้ง `DATABASE_SSL=true` แล้วรัน migration/seed ตามปกติ ควรใช้ database user ที่จำกัดสิทธิ์เฉพาะ schema ของแอป

## Automated checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Tests ครอบคลุม:

- HMAC signature ถูก/ผิด
- webhook verification ที่ไม่มี event
- webhook signature rejection
- duplicate webhook event
- per-user burst throttling
- การเลือกราศีและ fallback Flex Message
- ขอบเขตวันเกิดของทั้ง 12 ราศี

## Security checklist ก่อนเปิดจริง

- [ ] เก็บ LINE token, Channel secret, database URL, session secret และ Admin hash ใน secret manager เท่านั้น
- [ ] ไม่ commit `.env`; ตรวจ git history ว่าไม่มี secret หลุด
- [ ] ใช้ HTTPS เท่านั้น และเปิด Secure cookie ผ่าน `NODE_ENV=production`
- [ ] ใช้ Admin password อย่างน้อย 12–16 ตัวอักษรที่ไม่ซ้ำบริการอื่น
- [ ] จำกัดผู้ที่เข้าถึง Render/Supabase/LINE consoles และเปิด MFA
- [ ] ใช้ PostgreSQL user แบบ least privilege และบังคับ TLS ใน production
- [ ] ตรวจว่า signature validation ทำกับ raw body และไม่ bypass route `/webhook`
- [ ] เปิด webhook redelivery และติดตาม error/latency/LINE API failures
- [ ] ตั้ง backup และทดสอบ restore ของ PostgreSQL
- [ ] กำหนด retention สำหรับ `horoscope_requests` และล้าง `processed_webhook_events` เก่าตามนโยบายองค์กร
- [ ] จัดทำนโยบายความเป็นส่วนตัวภาษาไทย อธิบายข้อมูลที่เก็บ ระยะเวลา และช่องทางขอลบ
- [ ] ทดสอบการลบข้อมูลว่าลบประวัติแบบ cascade
- [ ] ตรวจคำทำนายทุกวันก่อน Published: ไม่มีการแพทย์ กฎหมาย หรือการเงินเฉพาะเจาะจง ไม่มีเหตุร้ายรุนแรง/ความตาย และไม่รับประกันผลแน่นอน
- [ ] ทดสอบ Rich Menu/Flex/Quick Reply บน LINE iOS และ Android
- [ ] ตั้ง alert สำหรับ response 5xx, database connection failures และจำนวน rate-limit ที่ผิดปกติ
- [ ] หมุน token ทันทีหากสงสัยว่ารั่ว และ redeploy

## การดูแลข้อมูลระยะยาว

ควรสร้าง scheduled database job เพื่อลบ event id ที่เก่ากว่าระยะ redelivery ที่องค์กรเลือก และ anonymize/delete request history ตาม privacy policy ตัวอย่าง SQL สำหรับการดำเนินงานภายหลัง:

```sql
DELETE FROM processed_webhook_events
WHERE processed_at < NOW() - INTERVAL '30 days';

DELETE FROM horoscope_requests
WHERE requested_at < NOW() - INTERVAL '180 days';
```

อย่าตั้ง job จนกว่าจะกำหนด retention policy และข้อกำหนดทางกฎหมายขององค์กรเรียบร้อย
