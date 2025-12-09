package com.backend.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "receipt_detail")
@Data
public class ReceiptDetail {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "header_id", nullable = false)
    private ReceiptHeader header;

    @ManyToOne
    @JoinColumn(name = "material_id")
    private Material material;

    // Fallback cho vật tư mới (chưa có trong danh mục)
    @Column(name = "name", length = 255)
    private String name;

    @Column(name = "spec", length = 255)
    private String spec;

    @Column(name = "code", length = 100)
    private String code;

    @ManyToOne
    @JoinColumn(name = "unit_id")
    private Unit unit;

    @Column(name = "price", precision = 18, scale = 2)
    private BigDecimal price;

    @Column(name = "qty_doc", precision = 18, scale = 3)
    private BigDecimal qtyDoc; // Số lượng trên chứng từ

    @Column(name = "qty_actual", precision = 18, scale = 3)
    private BigDecimal qtyActual; // Số lượng thực nhận

    @Column(name = "lot_number", length = 100)
    private String lotNumber; // Số lô

    @Column(name = "mfg_date")
    private LocalDate mfgDate; // Ngày sản xuất

    @Column(name = "exp_date")
    private LocalDate expDate; // Hạn sử dụng

    @Column(name = "total", precision = 18, scale = 2)
    private BigDecimal total; // Thành tiền = price × qtyActual

    // Helper methods
    public String getDisplayName() {
        return material != null ? material.getName() : name;
    }

    public String getDisplaySpec() {
        return material != null ? material.getSpec() : spec;
    }

    public String getDisplayCode() {
        return material != null ? material.getCode() : code;
    }

    @PrePersist
    @PreUpdate
    private void calculateTotal() {
        if (price != null && qtyActual != null) {
            total = price.multiply(qtyActual);
        }
    }
}