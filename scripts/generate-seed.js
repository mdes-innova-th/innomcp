const fs = require('fs');
const provs = 'กระบี่,กรุงเทพมหานคร,กาญจนบุรี,กาฬสินธุ์,กำแพงเพชร,ขอนแก่น,จันทบุรี,ฉะเชิงเทรา,ชลบุรี,ชัยนาท,ชัยภูมิ,ชุมพร,เชียงราย,เชียงใหม่,ตรัง,ตราด,ตาก,นครนายก,นครปฐม,นครพนม,นครราชสีมา,นครศรีธรรมราช,นครสวรรค์,นนทบุรี,นราธิวาส,น่าน,บึงกาฬ,บุรีรัมย์,ปทุมธานี,ประจวบคีรีขันธ์,ปราจีนบุรี,ปัตตานี,พระนครศรีอยุธยา,พะเยา,พังงา,พัทลุง,พิจิตร,พิษณุโลก,เพชรบุรี,เพชรบูรณ์,แพร่,ภูเก็ต,มหาสารคาม,มุกดาหาร,แม่ฮ่องสอน,ยโสธร,ยะลา,ร้อยเอ็ด,ระนอง,ระยอง,ราชบุรี,ลพบุรี,ลำปาง,ลำพูน,เลย,ศรีสะเกษ,สกลนคร,สงขลา,สตูล,สมุทรปราการ,สมุทรสงคราม,สมุทรสาคร,สระแก้ว,สระบุรี,สิงห์บุรี,สุโขทัย,สุพรรณบุรี,สุราษฎร์ธานี,สุรินทร์,หนองคาย,หนองบัวลำภู,อ่างทอง,อำนาจเจริญ,อุดรธานี,อุตรดิตถ์,อุทัยธานี,อุบลราชธานี'.split(',');

let sql = 'USE `innomcp-db`;\n\nINSERT IGNORE INTO knowledge_entities (id, domain, type, name_th, aliases, description, attributes, relations, source, confidence, version)\nVALUES\n';
const vals = [];
provs.forEach((p, i) => {
  let aliases = '[]';
  let region = 'กลาง';
  if (p === 'กรุงเทพมหานคร') { aliases = '["กทม", "กรุงเทพ"]'; }
  if (p === 'นครราชสีมา') { aliases = '["โคราช"]'; region = 'อีสาน'; }
  if (p === 'เชียงใหม่') { aliases = '["เจียงใหม่"]'; region = 'เหนือ'; }
  if (p === 'ภูเก็ต') { region = 'ใต้'; }
  
  vals.push(
    `('PROV-${String(i+1).padStart(2, '0')}', 'geo', 'province', '${p}', '${aliases}', 'จังหวัด${p}', '{"region":"${region}","lat":15,"lon":100}', '{}', '[{"name":"DOPA","url":"https://dopa.go.th"}]', 0.9, 'v1')`
  );
});

sql += vals.join(',\n') + ';';
fs.writeFileSync('database/init/03-seed-thai-geo.sql', sql);
console.log('Created 03-seed-thai-geo.sql with 77 provinces');
