package com.backend.repository;

import com.backend.entity.Material;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface MaterialRepository extends JpaRepository<Material, Long> {
    Material findByCode(String code);
    boolean existsByCode(String code);

    // category giờ là String ("A"/"B"/"C"/"D")
    List<Material> findByCategory(String category);

    @Query("SELECT m FROM Material m WHERE LOWER(m.name) LIKE LOWER(CONCAT('%', :keyword, '%')) ORDER BY m.name")
    List<Material> findByNameContainingIgnoreCase(@Param("keyword") String keyword);

    @Query("SELECT m FROM Material m WHERE LOWER(m.name) LIKE LOWER(CONCAT('%', :keyword, '%')) OR LOWER(m.code) LIKE LOWER(CONCAT('%', :keyword, '%')) ORDER BY m.name")
    List<Material> findByNameOrCodeContainingIgnoreCase(@Param("keyword") String keyword);

    List<Material> findByIdGreaterThanOrderByIdAsc(Long afterId, Pageable pageable);
}
