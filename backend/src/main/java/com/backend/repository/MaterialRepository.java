package com.backend.repository;

import com.backend.entity.Material;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface MaterialRepository extends JpaRepository<Material, Long> {
    Optional<Material> findByCode(String code);
    boolean existsByCode(String code);
    List<Material> findByCategory(Character category);

    // Tìm kiếm vật tư theo tên(department repository)
    @Query("SELECT m FROM Material m WHERE LOWER(m.name) LIKE LOWER(CONCAT('%', :keyword, '%')) ORDER BY m.name")
    List<Material> findByNameContainingIgnoreCase(@Param("keyword") String keyword);

    // Tìm kiếm vật tư theo tên hoặc mã
    @Query("SELECT m FROM Material m WHERE LOWER(m.name) LIKE LOWER(CONCAT('%', :keyword, '%')) OR LOWER(m.code) LIKE LOWER(CONCAT('%', :keyword, '%')) ORDER BY m.name")
    List<Material> findByNameOrCodeContainingIgnoreCase(@Param("keyword") String keyword);
}