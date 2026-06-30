package com.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Trang người dùng đã lọc (trạng thái + keyword) và phân trang ở backend,
 * kèm summary cho thẻ thống kê (tổng / chờ duyệt / đã duyệt).
 */
@Data
@AllArgsConstructor
@NoArgsConstructor
public class UserPageDTO {

    private List<UserDTO> items;

    private int page;
    private int size;
    private long totalElements;
    private int totalPages;

    // Summary trên toàn bộ (không gồm Admin / Ban Giám Hiệu)
    private long totalUsers;
    private long pendingUsers;
    private long approvedUsers;
}
