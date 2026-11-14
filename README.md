# Thiệp thôi nôi Hà Linh

Thiệp mời online: https://vinc-357-law.github.io/Invitation/

HTML, CSS và JavaScript thuần, không cần build. Nội dung website nằm trong `dist/`.

Khách xác nhận tham dự ngay trong thiệp. Phản hồi được gửi đến Google Apps Script để lưu vào bảng theo dõi của gia đình.

Nhạc nền: `Snowflakes_on_the_Cake.mp3`, do chủ thiệp cung cấp. Nhạc phát sau tương tác đầu tiên và có nút bật/tắt.

## Cập nhật website

Đẩy thay đổi trong `dist/` lên nhánh `main`. GitHub Actions tự xuất bản GitHub Pages; có thể chạy lại từ thẻ Actions bằng workflow `Publish invitation`.

## Kiểm tra

Chạy `node --test tests/guest-flow.test.cjs` để kiểm tra gửi trùng, lỗi mạng, đóng thiệp khi đang gửi và tổng lượt đoán.

Sau khi chỉnh bố cục, cần kiểm tra thiệp và các nút ở 320×568, 375×667, 390×844, 844×390, 1366×768 và 1920×1080; cả tiếng Việt và tiếng Anh, trước/sau khi chọn tham dự, và khi quay lại thiệp. Giữ chức năng cuộn khi bàn phím hoặc phóng to chữ cần thêm không gian.
