
;; flight-surety-app
;; <add a description here>

;; (use-trait trait-alias .data-trait.data-storage-trait)

;; constants
;;
(define-constant contract-owner tx-sender)

(define-constant test-data ".flight-surety-data")
(define-data-var data-contract principal 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.flight-surety-data)
(define-constant contract-data 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.flight-surety-data)

;; data maps and vars
;;

;; private functions
;;

;; public functions
;;

(define-read-only (registered-airline-count) 
  (contract-call? .flight-surety-data get-airlines-count)
)

(define-read-only (has-data-access) 
  (contract-call? .flight-surety-data is-whitelisted (as-contract tx-sender))
)

(define-read-only (has-airline-state (airline principal) (minState uint)) 
  (contract-call? .flight-surety-data has-airline-state airline minState)
)

(define-read-only (get-airline (airline principal)) 
  (contract-call? .flight-surety-data get-airline airline)
)

(define-public (whitelist-app-contract) 
  (contract-call? .flight-surety-data set-whitelisted (as-contract tx-sender) true)
)

(define-public (add-airline (airline principal) (airlineName (string-ascii 30)) (caller principal)) 
  (let 
    (
      (registeredAirlines (registered-airline-count))
      (airlineVotes  (+ (len (default-to (list ) (get voters (get-airline airline)))) u1) )
      (state (if (>= airlineVotes (+ (/ registeredAirlines u2) (mod registeredAirlines u2))) u2 u1))
    )
    
    (as-contract (contract-call? .flight-surety-data add-airline-data airline airlineName caller state ))
    
    
  )
)
;; (contract-call? .flight-surety-app registered-airline-count )

;;(define-public (call-data-contract (data-storage-ref <trait-alias>))
;;  (as-contract (contract-call? data-storage-ref check-connection tx-sender))
;;  
;;)


;;(define-public (call-data-contract)
;;  (contract-call? .flight-surety-data check-connection tx-sender)
;;  
;;)

;;(define-public (count-up (data-storage-ref <trait-alias>))
;;  (contract-call? data-storage-ref count)
;;)

;;(define-public (count-up)
;;  (contract-call? .flight-surety-data count)
;;)

;;(define-read-only (get-data-contract) 
;;  (var-get data-contract)
;;)