package com.backend.repository;

import com.backend.entity.Material;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface MaterialRepository extends JpaRepository<Material, Long> {
    Optional<Material> findByCode(String code);
    List<Material> findByNameContainingIgnoreCase(String name);
    boolean existsByCode(String code);
    List<Material> findByCategory(Character category);
}