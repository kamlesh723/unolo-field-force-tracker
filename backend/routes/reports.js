const express = require("express");
const pool = require("../config/database");
const {authenticateToken,requireManager} = require("../middleware/auth");

const router = express.Router();

router.get("/daily-summary",authenticateToken,requireManager,async(req,res)=>{
    try {
        const {date, employee_id} = req.query;

        if(!date){
            return res.status(400).json({
                success:false,
                message:"date query params require(YYYY-MM-DD)"
            })
        }

       if(!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid date format. Use YYYY-MM-DD'
            });
        }
        let sql = `
            SELECT
                u.id AS employee_id,
                u.name AS employee_name,
                COUNT(ch.id) AS checkins,
                COUNT(DISTINCT ch.client_id) AS clients_visited,
                ROUND(
                    SUM(
                        CASE
                            WHEN ch.checkout_time IS NOT NULL
                            THEN (JULIANDAY(ch.checkout_time)-JULIANDAY(ch.checkin_time))*24
                             ELSE 0
                        END
                    ),
                    2  
                ) AS working_hours
                 FROM users u
                 LEFT JOIN checkins ch
                    ON ch.employee_id = u.id
                    AND DATE(ch.checkin_time)=?
                 WHERE u.manager_id =?`;
                 const params = [date,req.user.id];

                 if(employee_id){
                    sql += ' AND u.id = ?';
                    params.push(employee_id)
                 }
                 sql += ' GROUP BY u.id';

            // Execute query
            const [rows] = await pool.execute(sql,params);

            // team-aggregation

            const teamSummary = {
                total_employees: rows.length,
                total_checkins:rows.reduce((sum,r)=>sum +r.checkins,0),
                total_working_hours: rows.reduce((sum, r) => sum + (r.working_hours || 0), 0),
                 unique_clients_visited: rows.reduce((set, r) => {
                if (r.clients_visited > 0) set.add(r.employee_id);
                return set;
            }, new Set()).size
            };
                
        res.json({
            success:true,
            data:{
                date,
                team_summary:teamSummary,
                employees:rows
            }
        });

    } catch (error) {
        console.error("dailt summary error:",error);
        res.status(500).json({success:false, message:"Failed to generate daily summary"})
    }
})

module.exports = router