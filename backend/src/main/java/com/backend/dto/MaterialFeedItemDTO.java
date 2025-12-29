package com.backend.dto;

import lombok.Data;

@Data
public class MaterialFeedItemDTO {
    private Long id;
    private String code;
    private String name;
    private String spec;

    private Long unitId;
    private String unitName;

    private String manufacturer;
    private String category; // "A"/"B"/"C"/"D"
}
