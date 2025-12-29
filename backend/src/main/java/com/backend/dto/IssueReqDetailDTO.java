package com.backend.dto;

import lombok.Data;
import java.math.BigDecimal;

@Data
public class IssueReqDetailDTO {
    private Long id;
    private Long materialId;
    private String materialName;
    private String spec;
    private Long unitId;
    private String unitName;
    private BigDecimal qtyRequested;
    private String proposedCode;
    private String proposedManufacturer;
    private Character category;
    private Boolean isNewMaterial;

    // Helper methods for frontend display
    public String getCategoryBadge() {
        if (category == null) return "secondary";
        switch (category) {
            case 'A': return "danger";
            case 'B': return "warning";
            case 'C': return "info";
            case 'D': return "success";
            default: return "secondary";
        }
    }

    public String getCategoryName() {
        if (category == null) return "Không xác định";
        switch (category) {
            case 'A': return "Loại A";
            case 'B': return "Loại B";
            case 'C': return "Loại C";
            case 'D': return "Loại D";
            default: return "Không xác định";
        }
    }
}