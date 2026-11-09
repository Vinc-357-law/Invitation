'use strict';
// Text bindings keep the current scene, form values and live feedback intact on a language change.
window.i18n = (() => {
  let language = 'vi';
  try { language = localStorage.getItem('aristia-language') === 'en' ? 'en' : 'vi'; } catch {}
  const bindings = new Map();
  const dictionary = new Map();
  function add(vi, en) { dictionary.set(vi, en); return vi; }
  function t(source, values = {}) {
    const template = language === 'en' ? dictionary.get(source) || source : source;
    return template.replace(/\{(\w+)\}/g, (_, key) => String(typeof values[key] === 'function' ? values[key]() : values[key] ?? ''));
  }
  function text(element, source, values = {}) {
    if (typeof element === 'string') element = document.getElementById(element);
    bindings.set(element, () => { element.textContent = t(source, values); });
    bindings.get(element)();
  }
  function bind(selector, vi, en, attribute) {
    add(vi, en);
    document.querySelectorAll(selector).forEach(element => {
      // Bind only direct text nodes so icons, inputs and decorative spans survive.
      if (attribute) {
        const key = {element, attribute};
        bindings.set(key, () => element.setAttribute(attribute, t(vi)));
        bindings.get(key)();
      } else {
        const nodes = [...element.childNodes].filter(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
        if (nodes.length === 1) {
          bindings.set(nodes[0], () => { nodes[0].textContent = t(vi); });
          bindings.get(nodes[0])();
        }
      }
    });
  }
  function setLanguage(next) {
    language = next === 'en' ? 'en' : 'vi';
    document.documentElement.lang = language;
    try { localStorage.setItem('aristia-language', language); } catch {}
    bindings.forEach(update => update());
    document.querySelectorAll('[data-language]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.language === language)));
    document.dispatchEvent(new CustomEvent('languagechange', {detail: {language}}));
  }
  return {add, t, text, bind, setLanguage, get language() { return language; }};
})();

(() => {
  const {add, bind} = i18n;
  const staticText = [
    ['title', 'Hà Linh · Thiệp mời thôi nôi', 'Hà Linh’s 1st Birthday · Invitation'],
    ['.loader-note', 'Đang chuẩn bị phép màu…', 'Preparing a little magic…'],
    ['.intro .eyebrow', 'MỘT MÓN QUÀ THẬT ĐẶC BIỆT', 'A VERY SPECIAL DELIVERY'],
    ['#headline', 'Một phép màu Giáng sinh', 'A little Christmas'],
    ['#headline em', 'bé nhỏ.', 'miracle.'],
    ['.subtitle', 'Mùa của những điều kỳ diệu. Một năm ngập tràn yêu thương.', 'A season of wonder. A year of love.'],
    ['#receive-hint', 'Chạm vào xe tuần lộc để nhận thiệp ', 'Tap the sleigh to receive your invitation '],
    ['.guest-kicker', 'MỪNG THÔI NÔI HÀ LINH', 'HÀ LINH’S 1ST BIRTHDAY'],
    ['.footer-place', 'GỬI YÊU THƯƠNG DƯỚI TRĂNG GIÁNG SINH', 'WITH LOVE, UNDER THE CHRISTMAS MOON'],
    ['.envelope-heading', 'Có một lá thư Giáng sinh gửi đến cả nhà!', 'A Christmas letter for the whole family!'],
    ['.kc-invite', 'Thân mời cả nhà đến chung vui', 'You’re warmly invited to celebrate'],
    ['#card-title', 'Tiệc thôi nôi', 'First Birthday Party'],
    ['.kc-age-text', 'Bé tròn 1 tuổi rồi!', 'One year old!'],
    ['.kc-at', 'Vào lúc', 'Starts at'],
    ['.kc-month', 'Tháng 12', 'December'],
    ['.kc-day', 'Chủ Nhật', 'Sunday'],
    ['.kc-restaurant', 'Nhà hàng Cocotte', 'Cocotte Restaurant'],
    ['.kc-street', '21 Ngô Thời Nhiệm, P. Xuân Hòa', '21 Ngô Thời Nhiệm, Xuân Hòa Ward'],
    ['.kc-city', 'TP. Hồ Chí Minh', 'Ho Chi Minh City'],
    ['.kc-close-1', 'Sự hiện diện của cả nhà là món quà', 'Your presence is the sweetest'],
    ['.kc-close-2', 'Giáng sinh ngọt ngào nhất của bé', 'Christmas gift for our little one'],
    ['#rsvp-open, #rsvp-title', 'Xác nhận tham dự', 'RSVP'],
    ['.card-actions a', 'Bản đồ ', 'Map '],
    ['#calendar-game', ' Đoán xem bé bốc gì', ' Guess what Hà Linh will pick'],
    ['#replay', ' Xem lại phép màu', ' Replay the magic'],
    ['.rsvp-name', 'Tên khách mời ', 'Your name '],
    ['.rsvp-options legend', 'Bạn có thể đến dự tiệc không?', 'Will you join us?'],
    ['.rsvp-options label:first-of-type', ' Sẽ đến', ' I’ll be there'],
    ['.rsvp-options label:last-of-type', ' Không thể đến', ' I can’t make it'],
    ['.rsvp-counts label:first-child', 'Người lớn ', 'Adults '],
    ['.rsvp-counts label:last-child', 'Trẻ em ', 'Children '],
    ['#rsvp-back, #calendar-back, #game-back', '← Về thiệp mời', '← Back to invitation'],
    ['.calendar-details', 'Chủ nhật · 18:00 · Giờ Việt Nam', 'Sunday · 6:00 PM · Vietnam time'],
    ['.event-calendar caption', 'Tháng 12 · 2026', 'December · 2026'],
    ['#game-title', 'Đoán xem bé bốc gì?', 'What will Hà Linh pick?'],
    ['#game-intro', 'Theo phong tục thôi nôi, bé sẽ chọn một món đồ trong mâm. Bạn đoán Hà Linh sẽ bốc món nào?', 'In the Vietnamese first-birthday tradition, a baby chooses an object that hints at their future. What do you think Hà Linh will pick?'],
    ['#game-change', 'Đổi lựa chọn', 'Change my guess']
  ];
  staticText.forEach(args => bind(...args));
  ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].forEach((day, i) => bind(`.event-calendar th:nth-child(${i + 1})`, ['T2','T3','T4','T5','T6','T7','CN'][i], day));
  const objects = [
    ['but','Bút','Pen','Nhà văn','Writer'], ['sach','Sách','Book','Học giả','Scholar'],
    ['tien','Tiền','Money','Doanh nhân','Entrepreneur'], ['micro','Micro','Microphone','Ca sĩ','Singer'],
    ['ongnghe','Ống nghe','Stethoscope','Bác sĩ','Doctor'], ['co','Cọ vẽ','Paintbrush','Họa sĩ','Artist'],
    ['thuoc','Thước','Ruler','Kiến trúc sư','Architect'], ['bong','Quả bóng','Ball','Vận động viên','Athlete']
  ];
  objects.forEach(([key, vi, en, roleVi, roleEn]) => {
    bind(`[data-item="${key}"] b`, vi, en); bind(`[data-item="${key}"] small`, roleVi, roleEn);
  });
  [
    ['#sleigh','Chạm xe tuần lộc để nhận thiệp mời','Tap the sleigh to receive your invitation'],
    ['.invitation-cue','Nhận thiệp mời','Receive your invitation'],
    ['.experience','Món quà thiệp mời của Hà Linh','Your invitation from Hà Linh'],
    ['#close','Đóng thiệp','Close invitation'],
    ['.event-day','20, ngày dự tiệc','20, party day'],
    ['.language-switch','Chọn ngôn ngữ','Choose language']
  ].forEach(([selector, vi, en]) => bind(selector, vi, en, 'aria-label'));
  const messages = [
    ['Bật nhạc','Play music'], ['Tắt nhạc','Mute music'],
    ['Bật nhạc Giáng sinh','Play Christmas music'], ['Tắt nhạc Giáng sinh','Mute Christmas music'],
    ['Trình duyệt chưa phát được nhạc. Hãy thử lại.','Your browser couldn’t play music. Please try again.'],
    ['Đang mở Google Calendar…','Opening Google Calendar…'], ['Đang mở lịch trên thiết bị…','Opening your calendar…'],
    ['Gia đình sẽ nhận được phản hồi của bạn ngay khi bạn bấm gửi.','Your response will be sent to the family when you submit.'],
    ['Bản xem thử · Phản hồi chỉ hiển thị trên trang này.','Preview · Your response is only shown on this page.'],
    ['Gửi phản hồi và xem lịch','Send RSVP & view calendar'], ['Xác nhận và xem lịch','Confirm & view calendar'],
    ['Vui lòng nhập tên khách mời.','Please enter your name.'], ['Vui lòng nhập ít nhất một người tham dự.','Please enter at least one guest.'],
    ['Sẽ đến · {adults} người lớn, {children} trẻ em.','Attending · {adults} adult(s), {children} child(ren).'],
    ['Không thể đến.','Unable to attend.'], ['Đang gửi…','Sending…'],
    ['Đã gửi phản hồi: {summary} Cảm ơn bạn!','RSVP sent: {summary} Thank you!'], ['Phản hồi thử: {summary}','Preview RSVP: {summary}'],
    ['Chưa gửi được phản hồi. Hãy kiểm tra kết nối mạng và thử lại.','Couldn’t send your RSVP. Check your connection and try again.'],
    ['Bản xem thử · Khi nối Google Sheets, dự đoán của mọi người sẽ hiện ở đây. Kết quả thật được bật mí trong tiệc tối 20.12.','Preview · Everyone’s guesses will appear here once Google Sheets is connected. The real result will be revealed at the party on December 20.'],
    ['Đang tải dự đoán của mọi người…','Loading everyone’s guesses…'],
    ['Chưa tải được dự đoán của mọi người. Kết quả thật được bật mí trong tiệc tối 20.12.','Couldn’t load the guesses. The real result will be revealed at the party on December 20.'],
    ['{total} lượt đoán · Kết quả thật được bật mí trong tiệc tối 20.12.','{total} guesses · The real result will be revealed at the party on December 20.'],
    ['Chưa gửi được dự đoán. Hãy thử lại sau.','Couldn’t send your guess. Please try again later.'],
    ['Bạn đoán Hà Linh sẽ bốc','You think Hà Linh will pick'],
    ['CÒN','COUNTING DOWN'], ['ĐẾN 20.12.2026','TO 20.12.2026'], ['NGÀY','DAYS'], ['GIỜ','HRS'], ['PHÚT','MIN'], ['GIÂY','SEC'],
    ['HÔM NAY','TODAY'], ['Tiệc đang diễn ra ✧','The celebration is here ✧'], ['Cảm ơn bạn đã chung vui cùng Hà Linh','Thank you for celebrating with Hà Linh'],
    ['Còn {d} ngày {h} giờ {m} phút đến tiệc thôi nôi','{d} days, {h} hours and {m} minutes until the first birthday']
  ];
  messages.forEach(([vi, en]) => add(vi, en));
  document.querySelectorAll('[data-language]').forEach(button => button.addEventListener('click', () => i18n.setLanguage(button.dataset.language)));
  i18n.setLanguage(i18n.language);
})();
