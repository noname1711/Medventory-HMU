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

    @ManyToOne(optional = false)
    @JoinColumn(name = "header_id", nullable = false)
    private ReceiptHeader header;

    @ManyToOne
    @JoinColumn(name = "material_id")
    private Material material;

    // snapshot fields
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
    private BigDecimal qtyDoc;

    @Column(name = "qty_actual", precision = 18, scale = 3)
    private BigDecimal qtyActual;

    @Column(name = "lot_number", length = 100)
    private String lotNumber;

    @Column(name = "mfg_date")
    private LocalDate mfgDate;

    @Column(name = "exp_date")
    private LocalDate expDate;

    @Column(name = "total", precision = 18, scale = 2)
    private BigDecimal total;
}
