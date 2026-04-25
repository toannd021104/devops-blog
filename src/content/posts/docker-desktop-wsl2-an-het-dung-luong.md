---
id: "1"
slug: "docker-desktop-wsl2-an-het-dung-luong"
title: "Docker Desktop đã “ăn” gần hết ổ D của tôi, nhưng thủ phạm thực ra là WSL2"
excerpt: "docker_data.vhdx phình lên gần 91GB trong khi dữ liệu Docker thực tế chỉ khoảng 15GB. Đây là cách tôi xử lý và thu gọn nó về đúng kích thước."
category: "Docker"
date: "Apr 25, 2026"
readTime: "5 min read"
image: "docker.jpg"
summary:
  - "Vì sao file docker_data.vhdx của Docker Desktop WSL2 có thể phình rất lớn"
  - "Lý do docker system df -v và dung lượng file VHDX thường không khớp nhau"
  - "Quy trình dọn Docker, shutdown WSL2 và compact VHDX để lấy lại dung lượng"
takeaways:
  - "WSL2 lưu filesystem trong file .vhdx và file này chỉ mở rộng chứ không tự co lại sau khi xóa dữ liệu"
  - "docker system df -v chỉ phản ánh dung lượng Docker đang dùng, không phản ánh kích thước file VHDX trên đĩa"
  - "Muốn lấy lại dung lượng thật sự, cần vừa dọn dữ liệu Docker vừa compact file VHDX sau khi shutdown WSL2"
---
Có một ngày tôi mở ổ `D:\` ra kiểm tra và giật mình vì Docker Desktop đang chiếm dung lượng quá vô lý.

File `docker_data.vhdx` của Docker Desktop WSL2 đã phình lên gần **91GB**. Nhưng khi kiểm tra lại bằng:

```bash
docker system df -v
```

thì tổng dữ liệu Docker thực tế chỉ còn khoảng **15GB**.

Lúc đó tôi mới nhận ra vấn đề không nằm ở việc Docker đang dùng quá nhiều image hay volume, mà nằm ở cách **WSL2 quản lý dữ liệu bên dưới**.

## Chuyện gì đang xảy ra?

Nếu bạn dùng Docker Desktop với backend WSL2, toàn bộ filesystem của distro sẽ được lưu trong một file đĩa ảo dạng `.vhdx`.

Với Docker Desktop, file đó thường là:

```text
docker_data.vhdx
```

Vấn đề là file này có một hành vi khá khó chịu:

- Nó **tự mở rộng** khi dữ liệu tăng lên
- Nhưng **không tự co lại** khi dữ liệu bên trong đã bị xóa

Nghĩa là trước đây bạn có thể từng pull nhiều image lớn, build nhiều layer nặng, tạo volume cỡ lớn, hoặc chạy vài workload tốn dung lượng. Sau này dù đã xóa gần hết, file `.vhdx` vẫn giữ nguyên kích thước đã từng mở rộng.

Thế nên mới có chuyện Docker thực tế chỉ còn dùng khoảng 15GB, nhưng file trên ổ đĩa vẫn nằm lì ở mức 91GB.

## Vì sao số liệu giữa Docker và ổ đĩa không khớp?

`docker system df -v` chỉ cho bạn thấy dung lượng mà Docker đang quản lý tại thời điểm hiện tại:

- images
- containers
- volumes
- build cache

Nó **không nói gì về độ phình của file `.vhdx`** trên Windows.

Nói cách khác:

- Docker báo phần dữ liệu còn đang dùng
- Windows lại đang nhìn vào kích thước file đĩa ảo đã từng mở rộng

Ngoài ra, việc ghi/xóa nhiều lần cũng làm file bị phân mảnh hơn, khiến footprint trên đĩa càng nhìn khó chịu hơn.

## Cách tôi xử lý

Tôi làm theo 3 bước đơn giản dưới đây.

## 1. Dọn toàn bộ dữ liệu Docker không còn dùng

Đầu tiên, tôi dọn hết những gì Docker không còn cần nữa:

```bash
docker container prune -f
docker volume prune -f
docker image prune -a -f
docker builder prune -a -f
docker system prune -a --volumes -f
```

Lệnh này sẽ xóa:

- container đã dừng
- volume không dùng
- image không còn được tham chiếu
- build cache

Nếu máy của bạn đang giữ nhiều image cũ hoặc cache build lâu ngày, chỉ riêng bước này đã giải phóng được khá nhiều dung lượng logic bên trong Docker.

## 2. Tắt hẳn WSL2

Sau khi dọn xong, tôi shutdown WSL2 để file đĩa ảo không còn bị giữ:

```powershell
wsl --shutdown
```

Bước này quan trọng. Nếu WSL2 hoặc Docker Desktop vẫn còn đang giữ file `.vhdx`, bạn sẽ không compact được nó đúng cách.

## 3. Compact file VHDX bằng DiskPart

Tiếp theo, tôi mở **PowerShell với quyền Administrator** rồi chạy:

```powershell
diskpart
```

Trong giao diện `DISKPART>`, tôi nhập:

```text
select vdisk file="D:\\WSLandDocker_Data\\DockerDesktopWSL\\disk\\docker_data.vhdx"
compact vdisk
exit
```

Nếu đường dẫn đúng và file không còn bị khóa, DiskPart sẽ báo:

> DiskPart successfully compacted the virtual disk file

Lúc đó file `docker_data.vhdx` sẽ co lại gần đúng với phần dung lượng thực tế mà Docker còn đang dùng.

## Kết quả thực tế

Sau khi làm xong, file Docker Desktop của tôi giảm từ:

- **91GB**

về còn khoảng:

- **15GB**

Tức là gần khớp với số liệu tôi thấy từ `docker system df -v`.

## Điều tôi rút ra sau vụ này

Nếu bạn dùng Docker Desktop trên Windows với WSL2, đừng chỉ nhìn mỗi dung lượng file `.vhdx` rồi kết luận Docker đang “ngốn” từng đó GB dữ liệu thật.

Nhiều trường hợp vấn đề nằm ở chỗ:

- dữ liệu cũ đã bị xóa nhưng file đĩa ảo chưa được thu gọn
- WSL2 không tự reclaim dung lượng theo cách nhiều người vẫn nghĩ
- Docker đã sạch hơn nhiều rồi, chỉ là lớp lưu trữ bên dưới vẫn còn phình

Từ đó về sau, mỗi lần tôi dọn Docker định kỳ, tôi luôn nhớ thêm một bước: **nếu thấy file VHDX vẫn bất thường, shutdown WSL2 và compact lại**.

## Kết

Nếu máy bạn cũng đang gặp cảnh `docker_data.vhdx` phình vô lý, đây là thứ nên kiểm tra đầu tiên.

Docker có thể không dùng nhiều đến vậy. Có khi chỉ là WSL2 chưa trả lại dung lượng cho bạn thôi.
