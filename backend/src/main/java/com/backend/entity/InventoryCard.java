package com.backend.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "inventory_card")
@Data
public class InventoryCard {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "material_id", nullable = false)
    private Material material;

    @ManyToOne
    @JoinColumn(name = "unit_id", nullable = false)
    private Unit unit;

    @Column(name = "warehouse_name", length = 255)
    private String warehouseName; // Tên kho

    @Column(name = "record_date")
    private LocalDate recordDate = LocalDate.now();

    @Column(name = "opening_stock", precision = 18, scale = 3)
    private BigDecimal openingStock = BigDecimal.ZERO; // Tồn đầu kỳ

    @Column(name = "qty_in", precision = 18, scale = 3)
    private BigDecimal qtyIn = BigDecimal.ZERO; // Số lượng nhập

    @Column(name = "qty_out", precision = 18, scale = 3)
    private BigDecimal qtyOut = BigDecimal.ZERO; // Số lượng xuất

    @Column(name = "closing_stock", precision = 18, scale = 3)
    private BigDecimal closingStock; // Tồn cuối kỳ = opening + in - out

    @Column(name = "supplier", length = 255)
    private String supplier; // Nhà cung cấp

    @Column(name = "lot_number", length = 100)
    private String lotNumber; // Số lô

    @Column(name = "mfg_date")
    private LocalDate mfgDate; // Ngày sản xuất

    @Column(name = "exp_date")
    private LocalDate expDate; // Hạn sử dụng

    @ManyToOne
    @JoinColumn(name = "sub_department_id")
    private SubDepartment subDepartment; // Khoa/phòng quản lý

    @PrePersist
    @PreUpdate
    private void calculateClosingStock() {
        closingStock = openingStock
                .add(qtyIn != null ? qtyIn : BigDecimal.ZERO)
                .subtract(qtyOut != null ? qtyOut : BigDecimal.ZERO);
    }

    // Check if stock is available
    public boolean hasStock(BigDecimal requestedQty) {
        BigDecimal available = closingStock != null ? closingStock : BigDecimal.ZERO;
        return available.compareTo(requestedQty) >= 0;
    }

    // Consume stock
    public void consumeStock(BigDecimal qty) {
        if (qtyOut == null) qtyOut = BigDecimal.ZERO;
        qtyOut = qtyOut.add(qty);
        calculateClosingStock();
    }

    // Add stock
    public void addStock(BigDecimal qty) {
        if (qtyIn == null) qtyIn = BigDecimal.ZERO;
        qtyIn = qtyIn.add(qty);
        calculateClosingStock();
    }
}