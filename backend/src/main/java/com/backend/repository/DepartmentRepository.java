package com.backend.repository;

import com.backend.entity.Department;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface DepartmentRepository extends JpaRepository<Department, Long> {
    Optional<Department> findByName(String name);
    boolean existsByName(String name);

    // THÊM PHƯƠNG THỨC TÌM KIẾM THEO KEYWORD
    @Query("SELECT d FROM Department d WHERE LOWER(d.name) LIKE LOWER(CONCAT('%', :keyword, '%')) ORDER BY d.name")
    List<Department> findByNameContainingIgnoreCase(@Param("keyword") String keyword);
}