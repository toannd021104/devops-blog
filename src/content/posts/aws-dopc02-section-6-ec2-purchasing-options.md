---
id: "12"
slug: "aws-dopc02-section-6-ec2-purchasing-options"
title: "AWS DOP-C02: Section 6 - Amazon EC2 | Purchasing Options: On-Demand, Reserved, Savings Plans, Dedicated, Capacity Reservation"
excerpt: "Lý thuyết đầy đủ về các mô hình mua EC2: On-Demand, Reserved Instance, Savings Plans, Dedicated Host/Instance và Capacity Reservation — kèm ví dụ minh họa cho từng loại."
category: "AWS DOP-C02"
date: "Jul 5, 2026"
readTime: "12 min read"
image: "dvp-c02.png"
summary:
  - "On-Demand là mức giá gốc, mọi mô hình khác đều được tính chiết khấu dựa trên nó"
  - "Reserved Instance cho mức giảm sâu nhất nhưng cứng nhắc, Savings Plans linh hoạt hơn với mức giảm gần tương đương"
  - "Dedicated Host/Instance là để giải quyết license và compliance, không phải để tiết kiệm tiền"
  - "Capacity Reservation chỉ đảm bảo có máy, không liên quan gì tới giá — hai chuyện khác nhau hoàn toàn"
takeaways:
  - "RI/Savings Plans lo về giá, Zonal RI/Capacity Reservation lo về việc có máy hay không — hai bài toán tách biệt"
  - "Standard RI và EC2 Instance Savings Plans có mức giảm cao ngang nhau, khác nhau ở chỗ linh hoạt cấu hình"
  - "Dedicated Host cho phép nhìn thấy socket/core vật lý, Dedicated Instance thì không"
  - "Capacity Reservation không tự sinh ra giảm giá, phải ghép với RI/Savings Plans mới vừa có máy vừa rẻ"
---

Từ đầu series tới giờ mình toàn nói về IAM. Giờ đổi món, sang **Amazon EC2** — cụ thể là phần hay bị hỏi lắt léo nhất trong DOP-C02: các cách mua EC2.

Có một chuyện đáng chú ý khi ôn phần này: đề thi rất thích gộp hai bài toán hoàn toàn khác nhau vào chung một câu hỏi. Bài toán thứ nhất là **trả tiền sao cho rẻ**. Bài toán thứ hai là **làm sao chắc chắn có máy để chạy**. Hai chuyện này độc lập với nhau:

```
Rẻ hơn      → On-Demand, Reserved Instance, Savings Plans, Spot
Chắc có máy → Capacity Reservation, Zonal RI
```

Cứ nhớ cái này trước, phần sau sẽ dễ vào hơn nhiều.

![5 mô hình mua EC2 xếp theo trục linh hoạt và mức tiết kiệm](https://claude.ai/assets/posts/aws-dopc02/section-6-ec2-purchasing-options/ec2-purchasing-options-overview.png)

## On-Demand

**On-Demand** là mô hình mặc định của EC2: trả tiền theo giờ hoặc theo giây sử dụng thực tế, không cam kết trước, không cần trả trước bất cứ khoản nào. Bật máy lên là bắt đầu tính tiền, tắt máy là ngừng.

```
Không upfront
Không commitment
Giá cao nhất trong tất cả mô hình
```

On-Demand chính là mức giá gốc — mọi mô hình còn lại (RI, Savings Plans) đều công bố mức giảm giá dựa trên con số On-Demand tương ứng. Nói "giảm 72%" tức là giảm 72% so với giá On-Demand của đúng instance type đó, ở đúng region đó.

**Ví dụ:** một team đang chạy môi trường staging, bật lên buổi sáng để test, tắt đi buổi tối, không theo lịch cố định. Vì thời gian chạy không đều và không cam kết được trước, On-Demand là lựa chọn duy nhất hợp lý ở đây — mọi mô hình cam kết khác đều yêu cầu biết trước mức sử dụng, mà trường hợp này thì không biết trước được.

## Reserved Instance (RI)

**Reserved Instance** là cam kết dùng một cấu hình instance cụ thể — gồm instance family, size, region, hệ điều hành, tenancy — trong 1 hoặc 3 năm, đổi lại được giảm giá sâu.

Một điểm cần hiểu đúng: RI không phải là một cái máy vật lý riêng biệt nào cả. Nó chỉ là một khoản chiết khấu áp lên usage On-Demand khi usage đó khớp đúng với cấu hình đã cam kết. Nếu bạn tắt máy đi, khoản chiết khấu đơn giản là không có gì để áp vào (trừ trường hợp No Upfront, vẫn bị tính tiền dù không chạy).

### Standard RI và Convertible RI

Loại
Mức giảm tối đa
Đổi cấu hình giữa chừng

Standard RI
~72% so với On-Demand
Không, chỉ đổi được size/AZ trong cùng family, hoặc bán lại qua Marketplace

Convertible RI
~66% so với On-Demand
Có, đổi được family, OS, tenancy trong suốt term

```
{
  "instanceType": "m5.xlarge",
  "region": "ap-southeast-1",
  "tenancy": "default",
  "platform": "Linux/UNIX",
  "term": "3yr",
  "offeringClass": "Standard",
  "paymentOption": "All Upfront"
}
```

### Ba phương thức thanh toán

- **All Upfront**: trả toàn bộ ngay từ đầu term, không phát sinh thêm chi phí nào khác trong suốt thời gian còn lại. Đây là cách cho mức giảm sâu nhất.
- **Partial Upfront**: trả một phần trước, phần còn lại chia đều theo giờ trong suốt term.
- **No Upfront**: không trả trước gì cả, bị tính giá giờ đã giảm cho mỗi giờ trong suốt term dù có dùng hay không. Cần có lịch sử billing tốt với AWS mới được mua loại này.

Nguyên tắc chung: trả trước càng nhiều, mức giảm giá càng sâu.

**Ví dụ mức giảm giá (minh họa):**

```
On-Demand m5.xlarge (Linux, ap-southeast-1): ~0.248 USD/giờ
Standard RI 3-year, All Upfront:    giảm ~72% → ~0.069 USD/giờ tương đương
Convertible RI 3-year, All Upfront: giảm ~66% → ~0.084 USD/giờ tương đương
```

Con số trên chỉ để thấy tỷ lệ, giá thực tế cần tra Pricing Calculator vì thay đổi theo region và thời điểm.

### Regional RI và Zonal RI

RI còn chia theo phạm vi áp dụng:

```
Regional RI  → chỉ là khoản giảm giá, áp dụng linh hoạt trong cả region, KHÔNG đảm bảo có máy
Zonal RI     → giảm giá + giữ chỗ capacity thật trong một Availability Zone cụ thể
```

**Ví dụ:** một hệ thống database backend chạy cố định trên r5.2xlarge tại một AZ duy nhất suốt 3 năm, không có kế hoạch đổi cấu hình. Đây là trường hợp lý tưởng cho Standard RI 3 năm trả hết một lần — vì mức độ dự đoán được gần như tuyệt đối, nên tận dụng được toàn bộ phần giảm giá sâu nhất mà không phải đánh đổi tính linh hoạt (vì cũng không cần linh hoạt).

RI không tự động gia hạn. Khi hết term mà không mua lại, hệ thống tự động chuyển về tính giá On-Demand cho phần usage đó.

## Savings Plans

**Savings Plans** là mô hình ra đời sau RI, và hiện AWS khuyến nghị dùng nó thay cho RI trong hầu hết trường hợp vì tính linh hoạt cao hơn nhiều. Thay vì cam kết một cấu hình instance cụ thể, bạn cam kết một mức chi tiêu tính bằng USD/giờ, còn instance nào chạy trong phạm vi cam kết đó được giảm giá tự động, không cần chọn trước.

### Ba loại Savings Plans liên quan compute

Loại
Mức giảm tối đa
Phạm vi áp dụng

Compute Savings Plans
~66%
EC2 (mọi family/size/region/OS/tenancy) + Fargate + Lambda

EC2 Instance Savings Plans
~72%
Một instance family cụ thể trong một region, nhưng mọi size/OS/tenancy trong family đó

SageMaker Savings Plans
~64%
Riêng SageMaker (training, inference, processing)

```
Compute SP:      commit $/giờ → áp dụng cho bất kỳ family, region, OS, kể cả Fargate/Lambda
EC2 Instance SP: commit $/giờ → chỉ trong 1 family + 1 region, nhưng mọi size/OS trong đó
```

### Thứ tự áp dụng discount

Khi có nhiều loại discount cùng lúc, AWS áp dụng theo thứ tự cố định:

```
1. Reserved Instance áp dụng trước, cho phần usage khớp đúng cấu hình
2. Savings Plans áp dụng cho phần còn lại,
   ưu tiên usage có % tiết kiệm cao nhất trước
3. Phần usage vượt commitment → tính theo giá On-Demand
```

Trong hệ thống nhiều account dùng Consolidated Billing, Savings Plans được áp dụng cho account chủ (owner account) trước, sau đó mới lan sang các account khác nếu có bật chia sẻ.

**Ví dụ:** bạn mua Compute Savings Plan 1 năm, commit 18.20 USD/giờ. Trong một giờ bất kỳ, bạn đang chạy 2 con r5.4xlarge (đã có RI riêng che phần này), thêm một số task Fargate, một con m5.24xlarge, và một ít Lambda. RI áp dụng trước cho 2 con r5.4xlarge. Phần còn lại — Fargate, m5.24xlarge — được Savings Plans áp dụng, ưu tiên phần có % tiết kiệm cao hơn trước, cho tới khi dùng hết 18.20 USD/giờ đã cam kết. Phần usage nào vượt ra ngoài mức commitment đó bị tính giá On-Demand bình thường.

Một điều cần lưu ý: Savings Plans không cover RDS, ElastiCache, Redshift — các dịch vụ này vẫn cần RI riêng nếu muốn giảm giá.

## Dedicated Host và Dedicated Instance

Khác với ba mô hình ở trên, mục tiêu của **Dedicated Host** và **Dedicated Instance** không phải là tiết kiệm chi phí — thực tế hai mô hình này thường **đắt hơn** shared tenancy thông thường. Mục tiêu ở đây là giải quyết bài toán tenancy và compliance, đặc biệt liên quan tới license phần mềm tính theo phần cứng vật lý.

Tiêu chí
Dedicated Instance
Dedicated Host

Mức độ cô lập
Chạy trên phần cứng riêng, nhưng vẫn có thể share physical server với instance khác cùng account
Toàn bộ physical server dành riêng cho account bạn

Kiểm soát vị trí instance trên host
Không
Có, chọn được instance chạy trên socket/core nào

Hợp với license BYOL theo socket/core vật lý
Không
Có

Xem được thông tin socket/core/host ID
Không
Có, qua AWS License Manager

Đặt trước bằng Reservation để giảm giá
Không có RI riêng cho hình thức này
Có, Dedicated Host Reservation theo term 1/3 năm

**Ví dụ:** một công ty có license Windows Server và SQL Server dạng Bring Your Own License (BYOL), tính phí theo số core vật lý mà license đang chạy trên đó. Nếu dùng shared tenancy hoặc Dedicated Instance thông thường, công ty không kiểm soát được instance đang nằm trên socket/core vật lý nào — dễ vi phạm điều khoản license mà không hề hay biết. Dedicated Host giải quyết đúng vấn đề này, vì nó cho phép nhìn thấy và kiểm soát chính xác server vật lý nào đang chạy workload nào, phục vụ đúng yêu cầu compliance của loại license này.

Nếu chỉ cần đảm bảo không share phần cứng với account khác mà không cần biết chi tiết socket/core, Dedicated Instance đã đủ đáp ứng và có chi phí thấp hơn Dedicated Host.

## Capacity Reservation

**On-Demand Capacity Reservation** đảm bảo một điều duy nhất: một instance type cụ thể, ở một AZ cụ thể, sẽ có sẵn để bạn dùng khi cần — hoàn toàn tách biệt khỏi bài toán giá cả.

```
Capacity Reservation KHÔNG tự động cho giảm giá.
Bạn vẫn trả giá On-Demand cho phần capacity đã reserve,
dù có dùng hay không dùng trong thời gian reserve đó.
```

Mô hình
Đảm bảo có máy
Có giảm giá

Regional RI / Savings Plans
Không
Có

Zonal RI
Có
Có

Capacity Reservation
Có
Không, trừ khi ghép thêm RI/Savings Plans

Điểm đáng chú ý nhất của Capacity Reservation là nó có thể ghép chung với Savings Plans hoặc RI đang có sẵn. Khi cấu hình khớp nhau, phần discount từ Savings Plans/RI vẫn áp dụng bình thường lên usage nằm trong reservation — tức là vừa chắc chắn có máy, vừa được giảm giá.

**Ví dụ:** một sàn thương mại điện tử biết trước sẽ cần thêm 200 con c5.2xlarge tại ap-southeast-1a, đúng khung giờ 00:00–06:00 trong đợt Black Friday. Nếu chỉ trông vào On-Demand, có rủi ro gặp lỗi `InsufficientCapacityError` khi AZ đó hết loại máy cần dùng đúng lúc cao điểm. Cách xử lý: tạo Capacity Reservation cho đúng 200 máy đó tại AZ đó trước giờ cao điểm, đồng thời áp Compute Savings Plans hiện có lên trên để phần usage này vẫn được giảm giá như bình thường. Sau khi sự kiện kết thúc, cần hủy reservation hoặc đưa instance count về 0, vì tiền vẫn tiếp tục tính dù không có máy nào chạy trong đó.

Với nhu cầu cần capacity dài hạn và ổn định, Zonal RI thường gọn hơn Capacity Reservation thuần, vì nó cho cả hai lợi ích — giá và capacity — trong cùng một gói.

## Bảng tổng hợp

Tình huống
Mô hình phù hợp

Traffic hoàn toàn không dự đoán được
On-Demand

Batch job chịu được gián đoạn, muốn giá thấp nhất
Spot Instance *(sẽ nói ở bài khác)*

Database backend chạy 3 năm không đổi cấu hình
Standard RI, 3 năm, trả hết một lần

Hạ tầng dùng nhiều family, hay đổi theo thế hệ mới
Compute Savings Plans

Family cố định nhưng size/OS hay đổi
EC2 Instance Savings Plans

Cần license theo socket/core vật lý (BYOL)
Dedicated Host

Cần cô lập phần cứng nhưng không cần biết socket/core
Dedicated Instance

Sự kiện lớn, bắt buộc phải có capacity đúng giờ
Capacity Reservation kết hợp Savings Plans

Vừa cần rẻ vừa cần chắc chắn có capacity dài hạn
Zonal Reserved Instance

## Kết luận

5 mô hình này chia làm hai nhóm rõ rệt. On-Demand, Reserved Instance, Savings Plans giải quyết bài toán **giá**. Dedicated Host/Instance giải quyết bài toán **compliance và tenancy**. Capacity Reservation giải quyết bài toán **đảm bảo có máy**. Đề thi DOP-C02 hay đánh lừa bằng cách cho tình huống cần capacity nhưng gợi ý đáp án là RI hoặc Savings Plans — hai thứ này chỉ đảm bảo về giá, không đảm bảo về việc có máy hay không, trừ khi là Zonal RI.

Ghi nhớ nhanh: thấy "guarantee capacity" hoặc "InsufficientCapacityError" thì nghĩ tới Capacity Reservation/Zonal RI. Thấy "BYOL" hoặc license theo socket/core vật lý thì nghĩ tới Dedicated Host. Thấy hạ tầng hay thay đổi, cần linh hoạt thì nghĩ tới Compute Savings Plans.

Bài tiếp theo trong Section 6 sẽ nói về Spot Instance, và cách mix nhiều purchasing option trong cùng một Auto Scaling Group.

Tài liệu AWS nên đọc thêm:

- [Reserved Instances for Amazon EC2](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-reserved-instances.html)
- [Compute Savings Plans and Reserved Instances](https://docs.aws.amazon.com/savingsplans/latest/userguide/sp-ris.html)
- [How Savings Plans apply to usage](https://docs.aws.amazon.com/savingsplans/latest/userguide/sp-applying.html)
- [Dedicated Hosts overview](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/dedicated-hosts-overview.html)
- [On-Demand Capacity Reservations](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-capacity-reservations.html)