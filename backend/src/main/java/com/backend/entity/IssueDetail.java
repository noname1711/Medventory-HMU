package com.backend.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.math.BigDecimal;

@Entity
@Table(name = "issue_detail")
@Data
public class IssueDetail {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "header_id", nullable = false)
    private IssueHeader header;

    @ManyToOne
    @JoinColumn(name = "material_id", nullable = false)
    private Material material;

    @ManyToOne
    @JoinColumn(name = "inventory_card_id")
    private InventoryCard inventoryCard; // Xuất từ lô nào

    // Thông tin hiển thị
    @Column(name = "name", length = 255)
    private String name;

    @Column(name = "spec", length = 255)
    private String spec;

    @Column(name = "code", length = 100)
    private String code;

    @ManyToOne
    @JoinColumn(name = "unit_id")
    private Unit unit;

    @Column(name = "unit_price", precision = 18, scale = 2)
    private BigDecimal unitPrice; // Giá xuất

    @Column(name = "qty_requested", precision = 18, scale = 3)
    private BigDecimal qtyRequested; // Số lượng yêu cầu (từ issue_req)

    @Column(name = "qty_issued", precision = 18, scale = 3)
    private BigDecimal qtyIssued; // Số lượng thực xuất (có thể ≤ yêu cầu)

    @Column(name = "total", precision = 18, scale = 2)
    private BigDecimal total; // Thành tiền = unitPrice × qtyIssued

    // Helper methods
    public String getDisplayName() {
        return material != null ? material.getName() : name;
    }

    @PrePersist
    @PreUpdate
    private void calculateTotal() {
        if (unitPrice != null && qtyIssued != null) {
            total = unitPrice.multiply(qtyIssued);
        }
    }
}