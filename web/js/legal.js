// Nội dung chính sách dự thảo, cần kiểm tra pháp lý và thông tin đơn vị vận hành trước khi công bố.
export const legalPages = {
  general: {
    title: 'Chính sách & Quy định chung',
    description: 'Các nguyên tắc sử dụng nền tảng quà tặng số Momevia.',
    sections: [
      {
        title: '1. Phạm vi dịch vụ',
        text: 'Momevia giúp người dùng xem mẫu, cá nhân hóa, tạo và chia sẻ quà tặng số thông qua đường liên kết. Một số tính năng như mua mẫu và chi trả cho nhà sáng tạo đang được hoàn thiện và chưa vận hành thương mại.'
      },
      {
        title: '2. Tài khoản người dùng',
        text: 'Bạn chịu trách nhiệm giữ an toàn thông tin đăng nhập, cung cấp thông tin phù hợp và không sử dụng tài khoản của người khác khi chưa được phép. Nếu phát hiện truy cập bất thường, hãy liên hệ bộ phận hỗ trợ.'
      },
      {
        title: '3. Nội dung được phép',
        text: 'Không đăng tải nội dung lừa đảo, quấy rối, vi phạm quyền riêng tư, vi phạm quyền sở hữu trí tuệ hoặc trái pháp luật. Người gửi chỉ được sử dụng ảnh, nhạc và thông tin cá nhân mà mình có quyền chia sẻ.'
      },
      {
        title: '4. Đường liên kết quà tặng',
        text: 'Người có đường liên kết có thể truy cập nội dung quà theo thiết lập hiện hành. Không nên đặt thông tin nhạy cảm vào quà tặng. Việc sở hữu liên kết không chứng minh được danh tính người nhận.'
      },
      {
        title: '5. Tạm ngừng hoặc xử lý nội dung',
        text: 'Momevia có thể tạm ẩn hoặc yêu cầu chỉnh sửa nội dung có dấu hiệu vi phạm. Cơ chế giải quyết khiếu nại và xử lý tranh chấp sẽ được công bố đầy đủ trước khi vận hành thương mại.'
      }
    ]
  },
  payment: {
    title: 'Chính sách thanh toán',
    description: 'Thông tin về giá mẫu, trạng thái thanh toán và các quy trình đang hoàn thiện.',
    sections: [
      {
        title: '1. Trạng thái thanh toán hiện tại',
        text: 'Momevia chưa kích hoạt chức năng thu tiền trực tuyến. Các mức giá hiển thị ở một số mẫu là thông tin tham khảo cho định hướng sản phẩm; việc kích hoạt quyền dùng mẫu hiện không phải giao dịch thanh toán thật.'
      },
      {
        title: '2. Giá bán và phí dịch vụ',
        text: 'Trước khi mở thanh toán thật, hệ thống sẽ thông báo tổng tiền, quyền sử dụng mẫu, thời gian vận hành quà và mọi phí phát sinh trước khi người mua xác nhận đơn.'
      },
      {
        title: '3. Xác nhận giao dịch',
        text: 'Khi tích hợp cổng thanh toán, đơn hàng chỉ được xác nhận hoàn tất sau khi nền tảng nhận và kiểm tra thông báo thanh toán hợp lệ từ nhà cung cấp. Không xác nhận đơn chỉ bằng ảnh chụp chuyển khoản.'
      },
      {
        title: '4. Hủy đơn và hoàn tiền',
        text: 'Hiện chưa phát sinh giao dịch thanh toán thật, nên chưa có yêu cầu hoàn tiền thực tế trên nền tảng. Các điều kiện hoàn tiền, thời hạn xử lý và đầu mối tiếp nhận sẽ được xác định trước khi mở bán chính thức.'
      },
      {
        title: '5. Hỗ trợ',
        text: 'Nếu gặp lỗi với mẫu hoặc việc tạo quà, bạn có thể gửi yêu cầu qua biểu mẫu Liên hệ hỗ trợ. Không chia sẻ thông tin thẻ, mã OTP hoặc mật khẩu trong yêu cầu.'
      }
    ]
  },
  privacy: {
    title: 'Chính sách bảo mật',
    description: 'Cách Momevia xử lý dữ liệu tài khoản, quà tặng và phản hồi.',
    sections: [
      {
        title: '1. Dữ liệu có thể được cung cấp',
        text: 'Khi đăng ký hoặc sử dụng dịch vụ, bạn có thể cung cấp tên, email, thông tin xác thực, ảnh cá nhân hóa, lời chúc, tên người nhận, lời hồi đáp và nội dung yêu cầu hỗ trợ. Nếu dùng Google/Zalo, nhà cung cấp có thể chia sẻ dữ liệu hồ sơ theo quyền bạn đồng ý.'
      },
      {
        title: '2. Mục đích sử dụng',
        text: 'Dữ liệu được dùng để xác thực tài khoản, lưu mẫu yêu thích, tạo và hiển thị quà, lưu phản hồi, hỗ trợ người dùng và xử lý sự cố. Hệ thống hiện không yêu cầu người nhận đăng ký tài khoản chỉ để mở quà.'
      },
      {
        title: '3. Chia sẻ và truy cập',
        text: 'Người có link quà hợp lệ có thể xem nội dung mà người gửi đã xuất bản. Người gửi cần cân nhắc thông tin và ảnh đưa vào món quà trước khi chia sẻ. Mã QR được tạo ngay trên thiết bị, không gửi link quà đến dịch vụ tạo QR bên ngoài. Đăng nhập qua Google hoặc Zalo có thể kết nối với nhà cung cấp tương ứng.'
      },
      {
        title: '4. Lưu trữ và bảo mật',
        text: 'Tài khoản email lưu mật khẩu dưới dạng giá trị băm có salt, không lưu mật khẩu gốc. Phiên đăng nhập sử dụng cookie HttpOnly. Các biện pháp lưu trữ, sao lưu, thời hạn lưu và kiểm soát truy cập sẽ cần tiếp tục hoàn thiện trước khi cung cấp dịch vụ công khai.'
      },
      {
        title: '5. Yêu cầu về dữ liệu',
        text: 'Bạn có thể liên hệ bộ phận hỗ trợ nếu cần sửa thông tin, phản ánh truy cập trái phép hoặc đề nghị xử lý dữ liệu của mình. Việc xử lý các yêu cầu này sẽ được xác nhận theo từng trường hợp trong giai đoạn hiện tại.'
      }
    ]
  },
  content: {
    title: 'Nội dung & Bản quyền',
    description: 'Quy tắc sử dụng mẫu thiết kế và tài nguyên sáng tạo.',
    sections: [
      {
        title: '1. Quyền đối với thiết kế',
        text: 'Nhà sáng tạo cần có quyền hợp lệ đối với thiết kế, hình ảnh, âm thanh, font và các tài nguyên đưa lên hệ thống. Việc đăng mẫu không chuyển quyền sở hữu trí tuệ cho người dùng khác.'
      },
      {
        title: '2. Phạm vi cá nhân hóa',
        text: 'Người mua hoặc người dùng chỉ chỉnh sửa những phần được mẫu cho phép. Việc tạo quà từ mẫu không tự động cấp quyền trích xuất, bán lại hoặc phân phối các thành phần gốc.'
      },
      {
        title: '3. Nội dung người dùng tải lên',
        text: 'Người gửi chịu trách nhiệm về quyền chia sẻ hình ảnh, tên, lời chúc và thông tin người nhận. Không đưa dữ liệu riêng tư của người khác lên nền tảng khi chưa có cơ sở phù hợp.'
      },
      {
        title: '4. Báo cáo vi phạm',
        text: 'Nếu phát hiện mẫu hoặc quà có dấu hiệu xâm phạm quyền tác giả, hãy gửi link, mô tả vấn đề và chứng cứ qua mục Liên hệ hỗ trợ để được xem xét.'
      }
    ]
  }
};

export function legalPage(key) {
  const current = legalPages[key];
  if (!current) return '';
  const menu = Object.entries(legalPages).map(([id, item]) => `
    <a href="/policies/${id}" data-link class="${id === key ? 'is-active' : ''}" ${id === key ? 'aria-current="page"' : ''}>${item.title}</a>`).join('');
  return `<section class="legal-hero"><div class="container">
    <span class="eyebrow">THÔNG TIN & CHÍNH SÁCH</span>
    <h1>${current.title}</h1>
    <p>${current.description}</p>
  </div></section>
  <section class="legal-body"><div class="container legal-layout">
    <nav class="legal-sidebar" aria-label="Danh sách chính sách"><h2>Các chính sách</h2>${menu}</nav>
    <article class="legal-document">
      <p class="legal-draft"><strong>Lưu ý:</strong> Nội dung đang trong quá trình hoàn thiện, cần xác nhận thông tin đơn vị vận hành và rà soát pháp lý trước khi áp dụng chính thức.</p>
      ${current.sections.map(section => `<section class="legal-section"><h2>${section.title}</h2><p>${section.text}</p></section>`).join('')}
      <div class="legal-help"><h2>Bạn cần hỗ trợ thêm?</h2><p>Gửi câu hỏi về chính sách hoặc phản ánh nội dung qua trung tâm hỗ trợ.</p><button class="btn btn--outline" type="button" data-action="support">Liên hệ hỗ trợ</button></div>
    </article>
  </div></section>`;
}
