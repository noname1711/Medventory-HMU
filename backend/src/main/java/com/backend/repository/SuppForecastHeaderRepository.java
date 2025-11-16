package com.backend.repository;

import com.backend.entity.SuppForecastHeader;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

@Repository
public interface SuppForecastHeaderRepository extends JpaRepository<SuppForecastHeader, Long> {
    List<SuppForecastHeader> findByStatusOrderByCreatedAtDesc(Integer status);
    List<SuppForecastHeader> findByStatusInOrderByCreatedAtDesc(List<Integer> statuses);
    Long countByStatus(Integer status);

    @Query("SELECT h FROM SuppForecastHeader h WHERE h.academicYear = :year")
    List<SuppForecastHeader> findByAcademicYear(@Param("year") String year);

    @Query("SELECT h FROM SuppForecastHeader h WHERE h.academicYear = :year AND h.department.id = :deptId")
    List<SuppForecastHeader> findByAcademicYearAndDepartmentId(
            @Param("year") String year,
            @Param("deptId") Long deptId   // nên dùng Long
    );
}