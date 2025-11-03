import {
  toYMD,
  sanitizeUserInput,
  sanitizeEmail,
  sanitizePhone,
  normalizeNumber,
} from "../lib/utils";
interface Campaign {
  campaign_id: number;
  campaign_name: string;
  start_date: string;
  end_date: string;
  max_winners: number | null;
  min_score_requirement: number | null;
  reward_description: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

interface Category {
  category_id: number;
  category_name: string;
  category_description: string;
  is_active: number;
}
interface JoinCampaign {
  user_id: number;
  campaign_id: number;
  terms_accepted: string;
  user_email: string;
  user_phone: string;
  section_id: number;
}

type ActionType = "create" | "edit" | "delete" | "";
type ValidateCampaignFields =
  | "campaign_id"
  | "is_active"
  | "campaign_name"
  | "start_date"
  | "end_date"
  | "max_winners"
  | "min_score_requirement"
  | "reward_description";
type ValidateCategoryFields =
  | "category_id"
  | "is_active"
  | "category_name"
  | "category_description";

type ValidateJoinCampaign =
  | "user_id"
  | "campaign_id"
  | "section_id"
  | "terms_accepted"
  | "user_email"
  | "user_phone";

const today = new Date().toISOString().split("T")[0].slice(0, 10);

const checkId = (id: unknown, action: ActionType, label: string): string => {
  if (action === "create") {
    return "";
  }
  if (id == null) {
    return `กรุณากรอก "${label}"`;
  }
  if (typeof id !== "number") {
    return `กรุณากรอกประเภท "${label}" ให้ถูกต้อง`;
  }
  if (!Number.isInteger(id) || id <= 0) {
    return `กรุณากรอกค่า "${label}" ให้ถูกต้อง`;
  }
  return "";
};

const checkActive = (is_active: unknown, label: string): string => {
  if (is_active == null) {
    return `กรุณากรอก "สถานะ ${label}"`;
  }
  if (typeof is_active !== "number") {
    return `กรุณากรอก "สถานะ ${label}" เป็นตัวเลข`;
  }
  if (is_active !== 0 && is_active !== 1) {
    return `กรุณาเลือก "สถานะ ${label}" ให้ถูกต้อง`;
  }
  return "";
};

const checkTextInput = ({
  text,
  label,
  require = true,
}: {
  text?: unknown;
  label: string;
  require?: boolean;
}): string => {
  if (!require && (text == null || text === "")) return "";
  if (typeof text !== "string") {
    return `กรุณากรอก "${label}" เป็นตัวอักษร`;
  }
  const val = text.trim();
  const valLength = val.length;
  if (require && valLength === 0) {
    return `กรุณากรอก "${label}"`;
  }

  if (valLength > 0) {
    const { result, valid } = sanitizeUserInput(val);
    if (!valid) {
      const invalidChar = Array.from(new Set(result)).join(",");
      return `ไม่อนุญาติให้ใช้ "${invalidChar}"`;
    }
  }
  return "";
};

const checkEmail = ({
  text,
  label,
  require = true,
}: {
  text?: unknown;
  label: string;
  require?: boolean;
}): string => {
  if (!require && (text == null || text === "")) return "";
  if (typeof text !== "string") {
    return `กรุณากรอก "${label}" เป็นตัวอักษร`;
  }
  const val = text.trim();
  const valLength = val.length;
  if (require && valLength === 0) {
    return `กรุณากรอก "${label}"`;
  }

  if (valLength > 0) {
    if (!sanitizeEmail(val)) {
      return `กรุณากรอก "${label}" ให้ถูกต้อง`;
    }
  }
  return "";
};

const checkPhone = ({
  text,
  label,
  require = true,
}: {
  text?: unknown;
  label: string;
  require?: boolean;
}): string => {
  if (!require && (text == null || text === "")) return "";
  if (typeof text !== "string") {
    return `กรุณากรอก "${label}" เป็นตัวอักษร`;
  }
  const val = text.trim();
  const valLength = val.length;
  if (require && valLength === 0) {
    return `กรุณากรอก "${label}"`;
  }

  if (valLength > 0) {
    const errMsg: string = sanitizePhone(val, label);
    if (errMsg) return errMsg;
    if (valLength < 9) {
      return `"${label}" ต้องมีอย่างน้อย 9 หลัก`;
    }
  }
  return "";
};

const checkMinValue = ({
  numValue,
  minValue,
  label,
  integerOnly = false,
}: {
  numValue: unknown;
  minValue: number;
  label: string;
  integerOnly?: boolean;
}): string => {
  //! check "" handle decimal from db as string
  if (numValue == null || numValue === "") {
    return `กรุณากรอก ${label}`;
  }

  const num = normalizeNumber(numValue);
  if (num === null) {
    return `กรุณากรอก "${label}" เป็นตัวเลข`;
  }

  if (integerOnly && !Number.isInteger(num)) {
    return `กรุณากรอก "${label}" เป็นตัวเลขจำนวนเต็ม`;
  }

  if (num < minValue) {
    return `"${label}" ต้องมากกว่าหรือเท่ากับ "${minValue}"`;
  }

  return "";
};
const validateCampaignForm = ({
  data,
  oldData,
  errors = {},
  field,
  action = "create",
}: {
  data: Partial<Campaign>;
  oldData?: Partial<Campaign> | null;
  errors?: Record<string, string>;
  field?: ValidateCampaignFields;
  action?: ActionType;
}): Record<string, string> => {
  // const errors: Record<string, string> = {};
  const validators: Record<string, () => void> = {
    campaign_id: () => {
      const errMsg = checkId(data.campaign_id, action, "รหัสกิจกรรม");
      if (errMsg) {
        errors.campaign_id = errMsg;
      } else {
        delete errors.campaign_id;
      }
    },
    is_active: () => {
      const errMsg = checkActive(data.is_active, "กิจกรรม");
      if (errMsg) {
        errors.is_active = errMsg;
      } else {
        delete errors.is_active;
      }
    },
    campaign_name: () => {
      const errMsg = checkTextInput({
        text: data.campaign_name,
        label: "ชื่อกิจกรรม",
      });
      if (errMsg) {
        errors.campaign_name = errMsg;
      } else {
        delete errors.campaign_name;
      }
    },
    start_date: () => {
      const compareDate =
        action === "edit" && oldData?.start_date
          ? toYMD(oldData.start_date) > today
            ? today
            : toYMD(oldData.start_date)
          : today;

      if (!data.start_date) {
        errors.start_date = 'กรุณากรอก "วันที่เริ่ม"';
      } else if (toYMD(data.start_date) < compareDate) {
        errors.start_date = `"วันที่เริ่ม" ไม่สามารถน้อยกว่าวันที่${
          action === "edit" ? "เดิม" : "ปัจจุบัน"
        }`;
      } else if (
        data.end_date &&
        toYMD(data.end_date) < toYMD(data.start_date)
      ) {
        errors.start_date = '"วันที่เริ่ม" ไม่สามารถมากกว่า "วันที่สิ้นสุด"';
      } else {
        delete errors.start_date;
      }
    },
    end_date: () => {
      const compareDate =
        action === "edit" && oldData?.start_date
          ? toYMD(oldData.start_date)
          : today;
      if (!data.end_date) {
        errors.end_date = 'กรุณากรอก "วันที่สิ้นสุด"';
      } else if (toYMD(data.end_date) < compareDate) {
        errors.end_date = `"วันที่สิ้นสุด" ไม่สามารถน้อยกว่าวันที่${
          action === "edit" ? "เริ่ม" : "ปัจจุบัน"
        }`;
      } else if (
        data.start_date &&
        toYMD(data.start_date) > toYMD(data.end_date)
      ) {
        errors.end_date = '"วันที่สิ้นสุด" ไม่สามารถน้อยกว่า "วันที่เริ่ม"';
      } else {
        delete errors.end_date;
      }
    },
    max_winners: () => {
      const errMsg = checkMinValue({
        numValue: data.max_winners,
        minValue: 1,
        label: "จำนวนผู้ชนะสูงสุด",
        integerOnly: true,
      });
      if (errMsg) {
        errors.max_winners = errMsg;
      } else {
        delete errors.max_winners;
      }
    },
    min_score_requirement: () => {
      const errMsg = checkMinValue({
        numValue: data.min_score_requirement,
        minValue: 0,
        label: "คะแนนขั้นต่ำ",
      });
      if (errMsg) {
        errors.min_score_requirement = errMsg;
      } else {
        delete errors.min_score_requirement;
      }
    },
    reward_description: () => {
      const errMsg = checkTextInput({
        text: data.reward_description,
        label: "รายละเอียดรางวัล",
        require: false,
      });
      if (errMsg) {
        errors.reward_description = errMsg;
      } else {
        delete errors.reward_description;
      }
    },
  };

  if (field) {
    validators[field]?.();
  } else {
    Object.values(validators).forEach((fn) => fn());
  }
  return errors;
};

const validateCategoryForm = ({
  data,
  errors = {},
  field,
  action = "create",
}: {
  data: Partial<Category>;
  errors?: Record<string, string>;
  field?: ValidateCategoryFields;
  action?: ActionType;
}): Record<string, string> => {
  const validators: Record<string, () => void> = {
    category_id: () => {
      const errMsg = checkId(data.category_id, action, "รหัสประเภทเบาะแส");
      if (errMsg) {
        errors.category_id = errMsg;
      } else {
        delete errors.category_id;
      }
    },
    is_active: () => {
      const errMsg = checkActive(data.is_active, "ประเภทเบาะแส");
      if (errMsg) {
        errors.is_active = errMsg;
      } else {
        delete errors.is_active;
      }
    },
    category_name: () => {
      const errMsg = checkTextInput({
        text: data.category_name,
        label: "ชื่อประเภทเบาะแส",
      });
      if (errMsg) {
        errors.category_name = errMsg;
      } else {
        delete errors.category_name;
      }
    },
    category_description: () => {
      const errMsg = checkTextInput({
        text: data.category_description,
        label: "รายละเอียดประเภทเบาะแส",
        require: false,
      });
      if (errMsg) {
        errors.category_description = errMsg;
      } else {
        delete errors.category_description;
      }
    },
  };

  if (field) {
    validators[field]?.();
  } else {
    Object.values(validators).forEach((fn) => fn());
  }
  return errors;
};

const ValidateJoin = ({
  data,
  errors = {},
  field,
  action = "",
}: {
  data: Partial<JoinCampaign>;
  errors?: Record<string, string>;
  field?: ValidateJoinCampaign;
  action?: ActionType;
}): Record<string, string> => {
  const validators: Record<string, () => void> = {
    user_id: () => {
      const errMsg = checkId(data.user_id, action, "รหัสผู้ใช้งาน");
      if (errMsg) {
        errors.user_id = errMsg;
      } else {
        delete errors.user_id;
      }
    },
    campaign_id: () => {
      const errMsg = checkId(data.campaign_id, action, "รหัสกิจกรรม");
      if (errMsg) {
        errors.campaign_id = errMsg;
      } else {
        delete errors.campaign_id;
      }
    },
    section_id: () => {
      const errMsg = checkId(data.section_id, action, "รหัสหน่วยงาน");
      if (errMsg) {
        errors.section_id = errMsg;
      } else {
        delete errors.section_id;
      }
    },
    terms_accepted: () => {
      const errMsg = checkActive(data.terms_accepted, "การยอมรับเงื่อนไข");
      if (errMsg) {
        errors.section_id = errMsg;
      } else {
        delete errors.section_id;
      }
    },
    user_email: () => {
      const errMsg = checkEmail({ text: data.user_email, label: "อีเมล" });
      if (errMsg) {
        errors.user_email = errMsg;
      } else {
        delete errors.user_email;
      }
    },
    user_phone: () => {
      const errMsg = checkPhone({
        text: data.user_phone,
        label: "หมายเลขโทรศัพท์",
      });
      if (errMsg) {
        errors.user_phone = errMsg;
      } else {
        delete errors.user_phone;
      }
    },
  };

  if (field) {
    validators[field]?.();
  } else {
    Object.values(validators).forEach((fn) => fn());
  }
  return errors;
};

export { validateCampaignForm, validateCategoryForm, ValidateJoin };
export type {
  ActionType,
  Campaign,
  Category,
  JoinCampaign,
  ValidateCampaignFields,
  ValidateCategoryFields,
};
