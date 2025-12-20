package com.backend.entity;

import jakarta.persistence.*;
import lombok.Data;

import java.math.BigDecimal;

@Entity
@Table(name = "issue_req_detail")
@Data
public class IssueReqDetail {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "header_id", nullable = false)
    private IssueReqHeader header;

    @ManyToOne
    @JoinColumn(name = "material_id")
    private Material material;

    @Column(name = "material_name", length = 255)
    private String materialName;

    @Column(name = "spec", length = 255)
    private String spec;

    @ManyToOne
    @JoinColumn(name = "unit_id")
    private Unit unit;

    @Column(name = "qty_requested", nullable = false, precision = 18, scale = 3)
    private BigDecimal qtyRequested;

    @Column(name = "proposed_code", length = 100)
    private String proposedCode;

    @Column(name = "proposed_manufacturer", length = 255)
    private String proposedManufacturer;

    @Column(name = "material_category", length = 1)
    private String materialCategory; // "A"/"B"/"C"/"D"

    // ===== Helpers =====
    public String getDisplayMaterialName() {
        return material != null ? material.getName() : materialName;
    }

    public String getDisplaySpec() {
        return material != null ? material.getSpec() : spec;
    }

    public String getDisplayUnit() {
        if (unit != null) return unit.getName();
        if (material != null && material.getUnit() != null) return material.getUnit().getName();
        return "";
    }

    public String getMaterialCategorySafe() {
        if (material != null) return material.getCategorySafe();
        return (materialCategory == null || materialCategory.isBlank()) ? "D" : materialCategory;
    }
}
