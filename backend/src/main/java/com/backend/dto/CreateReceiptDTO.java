package com.backend.dto;

import lombok.Data;

import java.time.LocalDate;
import java.util.List;

@Data
public class CreateReceiptDTO {
    private String receivedFrom;       // nhà cung cấp
    private String deliveryPerson;     // người giao (DB không có cột riêng -> sẽ gộp vào receivedFrom)
    private String reason;             // lý do nhập (default: "Nhu cầu từ đơn vị")
    private LocalDate receiptDate;     // ngày nhập (optional)
    private String warehouseName;      // optional, default "Kho chính"

    private List<CreateReceiptDetailDTO> details;
}
