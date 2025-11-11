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

    @ManyToOne
    @JoinColumn(name = "header_id", nullable = false)
    private IssueReqHeader header;

    @ManyToOne
    @JoinColumn(name = "material_id")
    private Material material;

    @Column(name = "material_name")
    private String materialName;

    private String spec;

    @ManyToOne
    @JoinColumn(name = "unit_id")
    private Unit unit;

    @Column(name = "qty_requested", nullable = false, precision = 18, scale = 3)
    private BigDecimal qtyRequested;

    @Column(name = "proposed_code")
    private String proposedCode;

    @Column(name = "proposed_manufacturer")
    private String proposedManufacturer;

    // Helper methods
    public String getDisplayMaterialName() {
        return material != null ? material.getName() : materialName;
    }

    public String getDisplaySpec() {
        return material != null ? material.getSpec() : spec;
    }

    public String getDisplayUnit() {
        return unit != null ? unit.getName() :
                material != null && material.getUnit() != null ? material.getUnit().getName() : "";
    }

    public Character getMaterialCategory() {
        return material != null ? material.getCategory() : 'D'; // Default to D for new materials
    }
}