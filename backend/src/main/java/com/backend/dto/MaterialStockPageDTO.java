package com.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Trang dữ liệu tồn kho đã được lọc + phân trang ở backend.
 * Kèm summary (tổng / sắp hết / hết hàng) tính trên toàn bộ danh mục
 * để FE hiển thị thẻ thống kê mà không phải tải hết dữ liệu.
 */
@Data
@AllArgsConstructor
@NoArgsConstructor
public class MaterialStockPageDTO {

    private List<MaterialStockDTO> items;

    // Phân trang (theo tập đã lọc)
    private int page;
    private int size;
    private long totalElements;
    private int totalPages;

    // Summary trên toàn bộ danh mục (không phụ thuộc bộ lọc/trang)
    private long totalItems;
    private long lowStock;
    private long outOfStock;
}
