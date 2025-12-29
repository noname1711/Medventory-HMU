package com.backend.dto;

import lombok.Data;
import java.time.LocalDate;

@Data
public class UserDTO {
    private Long id;
    private String fullName;
    private String email;
    private LocalDate dateOfBirth;
    private String department;
    private String role; // Tên vai trò (Ban Giám Hiệu, Lãnh đạo, Thủ kho, Cán bộ)
    private String status; // "Chờ duyệt", "Đã duyệt"
    private Integer roleCheck; // 0,1,2,3
    private Integer statusValue; // 0,1
    private Boolean isApproved;
    private Boolean isBanGiamHieu;
    private Boolean isLanhDao;
    private Boolean isThuKho;
    private Boolean isCanBo;

    private Long departmentId;
    private String departmentName;
}