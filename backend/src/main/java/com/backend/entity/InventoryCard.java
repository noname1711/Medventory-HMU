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
    @JoinColumn(name = "material_id")
    private Material material;

    @ManyToOne
    @JoinColumn(name = "unit_id")
    private Unit unit;

    @Column(name = "warehouse_name", length = 255)
    private String warehouseName;

    @Column(name = "record_date")
    private LocalDate recordDate;

    @Column(name = "opening_stock", precision = 18, scale = 3)
    private BigDecimal openingStock;

    @Column(name = "qty_in", precision = 18, scale = 3)
    private BigDecimal qtyIn;

    @Column(name = "qty_out", precision = 18, scale = 3)
    private BigDecimal qtyOut;

    // generated column in DB: opening_stock + qty_in - qty_out
    @Column(name = "closing_stock", precision = 18, scale = 3, insertable = false, updatable = false)
    private BigDecimal closingStock;

    @Column(name = "supplier", length = 255)
    private String supplier;

    @Column(name = "lot_number", length = 100)
    private String lotNumber;

    @Column(name = "mfg_date")
    private LocalDate mfgDate;

    @Column(name = "exp_date")
    private LocalDate expDate;

    @ManyToOne
    @JoinColumn(name = "sub_department_id")
    private SubDepartment subDepartment;

    @PrePersist
    public void prePersist() {
        if (recordDate == null) recordDate = LocalDate.now();
        if (openingStock == null) openingStock = BigDecimal.ZERO;
        if (qtyIn == null) qtyIn = BigDecimal.ZERO;
        if (qtyOut == null) qtyOut = BigDecimal.ZERO;
    }
}
