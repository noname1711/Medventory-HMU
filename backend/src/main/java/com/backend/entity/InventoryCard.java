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

    @Column(name = "warehouse_name")
    private String warehouseName;

    @Column(name = "record_date")
    private LocalDate recordDate = LocalDate.now();

    @Column(name = "opening_stock", precision = 18, scale = 3)
    private BigDecimal openingStock = BigDecimal.ZERO;

    @Column(name = "qty_in", precision = 18, scale = 3)
    private BigDecimal qtyIn = BigDecimal.ZERO;

    @Column(name = "qty_out", precision = 18, scale = 3)
    private BigDecimal qtyOut = BigDecimal.ZERO;

    // generated column in DB: opening_stock + qty_in - qty_out
    @Column(name = "closing_stock", precision = 18, scale = 3, insertable = false, updatable = false)
    private BigDecimal closingStock;

    @Column(name = "supplier")
    private String supplier;

    @Column(name = "lot_number")
    private String lotNumber;

    @Column(name = "mfg_date")
    private LocalDate mfgDate;

    @Column(name = "exp_date")
    private LocalDate expDate;

    @ManyToOne
    @JoinColumn(name = "sub_department_id")
    private SubDepartment subDepartment;
}
