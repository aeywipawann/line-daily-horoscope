import { DateTime } from "luxon";
import type { Horoscope, HoroscopeRequestType, ZodiacKey } from "./types.js";
import { zodiacKeys } from "./types.js";
import { zodiacThai } from "./zodiac.js";
import type { LineMessage } from "./line-client.js";

const DISCLAIMER = "คำทำนายนี้จัดทำขึ้นเพื่อความบันเทิงและเป็นแนวทางทั่วไปเท่านั้น";

export function zodiacPickerMessage(): LineMessage {
  return {
    type: "text",
    text: "เลือกวันเกิดหรือราศีของคุณได้เลย ✨",
    quickReply: {
      items: [
        {
          type: "action",
          action: {
            type: "datetimepicker",
            label: "เลือกวันเกิด",
            data: "action=set_birthdate",
            mode: "date",
            initial: "1995-01-01",
            min: "1900-01-01",
            max: DateTime.now().setZone("Asia/Bangkok").toISODate(),
          },
        },
        ...zodiacKeys.map((key) => ({
          type: "action",
          action: {
            type: "postback",
            label: `ราศี${zodiacThai[key]}`,
            data: `action=set_zodiac&zodiac=${key}&request=daily`,
            displayText: `เลือกราศี${zodiacThai[key]}`,
          },
        })),
      ],
    },
  };
}

export function horoscopeFlexMessage(
  horoscope: Horoscope,
  requestType: HoroscopeRequestType = "daily",
): LineMessage {
  const date = DateTime.fromISO(horoscope.horoscopeDate, {
    zone: "Asia/Bangkok",
  }).setLocale("th");
  const sections =
    requestType === "daily"
      ? [
          ["ภาพรวม", horoscope.overview],
          ["การงาน", horoscope.career],
          ["การเงิน", horoscope.finance],
          ["ความรัก", horoscope.love],
          ["สุขภาพทั่วไป", horoscope.health],
        ]
      : requestType === "love"
        ? [["ความรัก", horoscope.love], ["คำแนะนำ", horoscope.advice]]
        : requestType === "career"
          ? [["การงาน", horoscope.career], ["คำแนะนำ", horoscope.advice]]
          : requestType === "finance"
            ? [["การเงิน", horoscope.finance], ["คำแนะนำ", horoscope.advice]]
            : [["เลขนำโชค", horoscope.luckyNumber], ["สีมงคล", horoscope.luckyColor]];

  return {
    type: "flex",
    altText: `ดวงราศี${zodiacThai[horoscope.zodiacSign]} ประจำวันที่ ${date.toFormat("d LLL yyyy")}`,
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#5B3F8C",
        paddingAll: "20px",
        contents: [
          {
            type: "text",
            text: `ราศี${zodiacThai[horoscope.zodiacSign]} ✨`,
            color: "#FFFFFF",
            weight: "bold",
            size: "xl",
          },
          {
            type: "text",
            text: date.toFormat("d LLLL yyyy"),
            color: "#E8DDFC",
            size: "sm",
            margin: "sm",
          },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          ...sections.flatMap(([title, body]) => [
            { type: "text", text: title, weight: "bold", color: "#5B3F8C" },
            { type: "text", text: body, wrap: true, size: "sm", color: "#333333" },
          ]),
          {
            type: "separator",
            margin: "lg",
          },
          {
            type: "box",
            layout: "horizontal",
            margin: "lg",
            contents: [
              { type: "text", text: `สีมงคล: ${horoscope.luckyColor}`, size: "sm" },
              {
                type: "text",
                text: `เลขนำโชค: ${horoscope.luckyNumber}`,
                size: "sm",
                align: "end",
              },
            ],
          },
          { type: "text", text: `💡 ${horoscope.advice}`, wrap: true, size: "sm" },
          {
            type: "text",
            text: DISCLAIMER,
            wrap: true,
            size: "xxs",
            color: "#888888",
            margin: "lg",
          },
        ],
      },
      footer: {
        type: "box",
        layout: "horizontal",
        contents: [
          {
            type: "button",
            style: "link",
            action: {
              type: "postback",
              label: "เปลี่ยนราศี",
              data: "action=change_zodiac",
              displayText: "เปลี่ยนราศี",
            },
          },
          {
            type: "button",
            style: "link",
            color: "#B23A48",
            action: {
              type: "postback",
              label: "ลบข้อมูล",
              data: "action=confirm_delete",
              displayText: "ขอลบข้อมูลของฉัน",
            },
          },
        ],
      },
    },
  };
}

export function fallbackHoroscope(date: string, zodiac: ZodiacKey): Horoscope {
  return {
    horoscopeDate: date,
    zodiacSign: zodiac,
    overview: "วันนี้เหมาะกับการค่อย ๆ จัดลำดับเรื่องสำคัญ และเปิดรับมุมมองใหม่",
    career: "งานเดินหน้าได้ดีเมื่อสื่อสารให้ชัดและแบ่งเป้าหมายเป็นขั้นเล็ก ๆ",
    finance: "ทบทวนรายรับรายจ่ายตามแผน และเว้นจังหวะก่อนตัดสินใจซื้อของชิ้นใหญ่",
    love: "การรับฟังกันด้วยใจเย็นช่วยให้ความสัมพันธ์สบายใจขึ้น",
    health: "พักผ่อนให้เพียงพอ ดื่มน้ำ และขยับร่างกายตามความเหมาะสม",
    luckyColor: "ม่วงอ่อน",
    luckyNumber: "6, 9",
    advice: "ทำสิ่งตรงหน้าให้ดีที่สุด แล้วให้เวลากับผลลัพธ์",
    status: "published",
  };
}

export function deletionConfirmationMessage(): LineMessage {
  return {
    type: "template",
    altText: "ยืนยันการลบข้อมูล",
    template: {
      type: "confirm",
      text: "ต้องการลบราศี วันเกิด และประวัติการใช้งานทั้งหมดใช่ไหม?",
      actions: [
        {
          type: "postback",
          label: "ลบข้อมูล",
          data: "action=delete_data",
          displayText: "ยืนยันลบข้อมูล",
        },
        {
          type: "message",
          label: "ยกเลิก",
          text: "ยกเลิก",
        },
      ],
    },
  };
}

export function textMessage(text: string): LineMessage {
  return { type: "text", text };
}
