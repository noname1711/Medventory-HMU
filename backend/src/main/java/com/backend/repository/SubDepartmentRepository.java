package com.backend.repository;

import com.backend.entity.SubDepartment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface SubDepartmentRepository extends JpaRepository<SubDepartment, Long> {
    List<SubDepartment> findByDepartmentId(Long departmentId);
    Optional<SubDepartment> findByNameAndDepartmentId(String name, Long departmentId);
    List<SubDepartment> findByDepartmentName(String departmentName);
}