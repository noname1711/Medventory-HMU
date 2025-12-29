package com.backend.repository;

import com.backend.entity.SuppForecastHeader;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface SuppForecastHeaderRepository extends JpaRepository<SuppForecastHeader, Long> {

    List<SuppForecastHeader> findByStatus_CodeOrderByCreatedAtDesc(String statusCode);

    List<SuppForecastHeader> findByStatus_CodeInOrderByCreatedAtDesc(List<String> statusCodes);

    Long countByStatus_Code(String statusCode);

    @Query("SELECT h FROM SuppForecastHeader h WHERE h.academicYear = :year")
    List<SuppForecastHeader> findByAcademicYear(@Param("year") String year);

    @Query("SELECT h FROM SuppForecastHeader h WHERE h.academicYear = :year AND h.department.id = :deptId")
    List<SuppForecastHeader> findByAcademicYearAndDepartmentId(
            @Param("year") String year,
            @Param("deptId") Long deptId
    );
}
