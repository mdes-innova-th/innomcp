// ฟังก์ชันแปลงวันที่เป็นรูปแบบไทย วว ดดดด ปปปป (เดือนเต็ม)
export function formatThaiDateLongMonth(dateStr: string) {
  if (!dateStr) return "";
  const months = [
    "มกราคม",
    "กุมภาพันธ์",
    "มีนาคม",
    "เมษายน",
    "พฤษภาคม",
    "มิถุนายน",
    "กรกฎาคม",
    "สิงหาคม",
    "กันยายน",
    "ตุลาคม",
    "พฤศจิกายน",
    "ธันวาคม",
  ];
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const day = d.getDate();
  const month = months[d.getMonth()];
  const year = d.getFullYear() + 543;
  return `${day} ${month} ${year}`;
}

// ฟังก์ชันแปลงวันที่เป็นรูปแบบไทย วว ดด ปป
export function formatThaiDateShort(dateStr: string) {
  if (!dateStr) return "";
  const months = [
    "ม.ค.",
    "ก.พ.",
    "มี.ค.",
    "เม.ย.",
    "พ.ค.",
    "มิ.ย.",
    "ก.ค.",
    "ส.ค.",
    "ก.ย.",
    "ต.ค.",
    "พ.ย.",
    "ธ.ค.",
  ];
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const day = d.getDate();
  const month = months[d.getMonth()];
  const year = (d.getFullYear() + 543).toString().slice(-2);
  return `${day} ${month} ${year}`;
}

// ฟังก์ชันแปลงวันที่เป็นรูปแบบไทย วว ดด ปปปป
export function formatThaiDateFullYear(dateStr: string) {
  if (!dateStr) return "";
  const months = [
    "ม.ค.",
    "ก.พ.",
    "มี.ค.",
    "เม.ย.",
    "พ.ค.",
    "มิ.ย.",
    "ก.ค.",
    "ส.ค.",
    "ก.ย.",
    "ต.ค.",
    "พ.ย.",
    "ธ.ค.",
  ];
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const day = d.getDate();
  const month = months[d.getMonth()];
  const year = d.getFullYear() + 543;
  return `${day} ${month} ${year}`;
}

// ฟังก์ชันแปลงวันที่และเวลาเป็นรูปแบบไทย
export function formatThaiDateTime(dateStr: string) {
  if (!dateStr) return "";
  const months = [
    "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."
  ];
  // รองรับรูปแบบ 'YYYY-MM-DD HH:mm:ss' หรือ 'YYYY-MM-DDTHH:mm:ss'
  let datePart = "";
  let timePart = "";
  if (dateStr.includes("T")) {
    // ISO format
    const [date, time] = dateStr.split("T");
    datePart = date;
    timePart = time ? time.substring(0,5) : "";
  } else if (dateStr.includes(" ")) {
    // MySQL format
    const [date, time] = dateStr.split(" ");
    datePart = date;
    timePart = time ? time.substring(0,5) : "";
  } else {
    // date only
    datePart = dateStr;
    timePart = "";
  }
  const [y, m, d] = datePart.split("-");
  if (!y || !m || !d) return dateStr;
  const year = (parseInt(y,10) + 543);
  const month = months[parseInt(m,10)-1];
  const day = parseInt(d,10);
  if (timePart) {
    return `${day} ${month} ${year}, ${timePart}`;
  } else {
    return `${day} ${month} ${year}`;
  }
}
