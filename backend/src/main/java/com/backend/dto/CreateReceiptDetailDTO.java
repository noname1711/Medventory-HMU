package com.backend.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class CreateReceiptDetailDTO {
    // Cho phép frontend gửi materialId hoặc code (để hỗ trợ nhập code)
    private Long materialId;
    private String materialCode;

    private BigDecimal price;
    private BigDecimal qtyDoc;
    private BigDecimal qtyActual;

    private String lotNumber;
    private LocalDate mfgDate;
    private LocalDate expDate;
}
