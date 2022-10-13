
;; flight-surety-app
;; <add a description here>



(define-constant ERR_CONTRACT_PAUSED (err u3010))
(define-constant ERR_UNAUTHORISED (err u3011))

(define-constant AIRLINE_NOT_FOUND (err u3001))
(define-constant BAD_AIRLINE_STATUS (err u3002))
(define-constant AIRLINE_ALREADY_REGISTERED (err u3003))
(define-constant ONLY_BY_REGISTERED_AIRLINE (err u3004))
(define-constant AIRLINE_NOT_IN_APPLICATION (err u3005))
(define-constant AIRLINE_NAME_NOT_PROVIDED (err u3006))
(define-constant ALREADY_VOTED (err u3007))
;; constants
;;
(define-constant CONTRACT_OWNER tx-sender)
;;(define-constant contract-data 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.flight-surety-data)
;;(define-constant test-data ".flight-surety-data")

;;(define-data-var data-contract principal 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.flight-surety-data)
(define-data-var operational bool true)


;; contract authorizations
;;
(define-read-only (is-operational) 
  (var-get operational)
)

(define-read-only (has-data-access) 
  (contract-call? .flight-surety-data is-whitelisted (as-contract tx-sender))
)

(define-public (set-operating-status (status bool))
  (begin
    (asserts! (is-eq CONTRACT_OWNER tx-sender) ERR_UNAUTHORISED)
    (ok (var-set operational status))
  )
)

(define-public (whitelist-app-contract)
  (begin
    (asserts! (is-eq CONTRACT_OWNER tx-sender) ERR_UNAUTHORISED) 
    (contract-call? .flight-surety-data set-whitelisted (as-contract tx-sender) true)
  )
)

;; airline functions
;;



(define-read-only (registered-airline-count)  ;; to airline count
  (contract-call? .flight-surety-data get-airlines-count)
)

(define-read-only (get-airline (airline principal)) ;; main get fct , following extract throuh private
  (contract-call? .flight-surety-data get-airline airline)
)

(define-read-only (has-airline-state (airline principal) (minState uint)) ;;; Keep or make own fct in app 
  (contract-call? .flight-surety-data has-airline-state airline minState)
)



(define-public (add-airline (airline principal) (airlineName (string-ascii 30)) (caller principal)) 
  (let 
    (
      (registeredAirlines (registered-airline-count))
      (airlineVotes  (+ (len (default-to (list ) (get voters (get-airline airline)))) u1) )     
      (state (if (>= airlineVotes (+ (/ registeredAirlines u2) (mod registeredAirlines u2))) u2 u1))
    )
    (asserts! (is-operational) ERR_CONTRACT_PAUSED)

    (as-contract (contract-call? .flight-surety-data add-airline-data airline airlineName caller state ))
    
  )
)
;; (contract-call? .flight-surety-app registered-airline-count )

