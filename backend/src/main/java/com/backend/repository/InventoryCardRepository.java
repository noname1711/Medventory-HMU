package com.backend.repository;

import com.backend.entity.InventoryCard;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface InventoryCardRepository extends JpaRepository<InventoryCard, Long> {

    // NOTE: material là ManyToOne => dùng material_Id
    Optional<InventoryCard> findTopByMaterial_IdAndLotNumberOrderByRecordDateDescIdDesc(Long materialId, String lotNumber);

    @Query(value = """
            SELECT * FROM (
                SELECT DISTINCT ON (ic.lot_number) ic.*
                FROM inventory_card ic
                WHERE ic.material_id = :materialId
                ORDER BY ic.lot_number, ic.record_date DESC, ic.id DESC
            ) t
            WHERE t.closing_stock > 0
            ORDER BY t.exp_date NULLS LAST, t.mfg_date NULLS LAST, t.lot_number
            """, nativeQuery = true)
    List<InventoryCard> findAvailableLotsLatestByMaterial(@Param("materialId") Long materialId);

    @Query(value = """
            SELECT * FROM inventory_card
            WHERE material_id = :materialId AND lot_number = :lotNumber
            ORDER BY record_date DESC, id DESC
            LIMIT 1
            FOR UPDATE
            """, nativeQuery = true)
    Optional<InventoryCard> lockLatestByMaterialAndLot(@Param("materialId") Long materialId,
                                                       @Param("lotNumber") String lotNumber);

    @Query("""
    SELECT 
        ic.material.id,
        SUM(ic.closingStock)
    FROM InventoryCard ic
    GROUP BY ic.material.id
""")
    List<Object[]> sumClosingStockGroupByMaterial();

}

