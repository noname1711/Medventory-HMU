package com.backend.dto;

import lombok.Data;
import java.util.List;

@Data
public class SuppForecastRequestDTO {
    private String academicYear;
    private Long departmentId;       // optional
    private String createdByEmail;      // optional - sẽ tìm user theo email
    private List<SuppForecastDetailDTO> items;
}