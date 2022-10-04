
;; flight-surety-data
;; <add a description here>
;;(impl-trait .data-trait.data-storage-trait)

;; error consts
;;
(define-constant ERR_UNAUTHORISED (err u1001))
(define-constant NOT_WHITELISTED (err u1002))

(define-constant AIRLINE_NOT_FOUND (err u2001))
(define-constant BAD_AIRLINE_STATUS (err u2002))
(define-constant AIRLINE_ALREADY_REGISTERED (err u2003))

;; constants
;;
(define-constant CONTRACT_OWNER tx-sender)
(define-constant CONTRACT_ADDRESS (as-contract tx-sender))
(define-constant AIRLINE_STATE 
  (list "Init" "Application" "Registered" "Funded")
)

;; data maps and vars
;;
(define-data-var authAirlines uint u0)  ;; Airlines authorized for consensus voting
(define-data-var registeredAirlines uint u0) ;; Airlines registered
(define-data-var idCounter uint u0)  ;; Airlines ID counter

(define-map AuthorizedCallers principal bool)
(define-map Airlines 
  principal 
  { 
    airline-id: uint,
    airline-state: uint,
    airline-name: (string-ascii 40),
    voters:  (list 25 principal),
  }
)

;; verify if necessary
(define-map RegisteredAirlines { airline-id: uint } { airline: principal })
(define-map VotingAirlines { airline-id: uint } { airline: principal, voters:  (list 25 principal) ,active: bool })

(ok (register-airline-init 'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5 (some "Name") 'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5))
(ok (register-airline 'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5))
;; add first ariline
;;(map-set Airlines 
;;  'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5 
;;  {
;;    airline-id: u1,
;;    airline-state: u2,
;;    airline-name: "First Airline",
;;    voters: (list ),
;;  }  
;;)
;;(var-set registeredAirlines u1)


;; private functions
;;
(define-private (is-airline (address principal)) (> (unwrap-panic (get airline-state (map-get? Airlines address))) u1))

(define-private (register-airline-init (airline principal) (airlineName (optional (string-ascii 40))) (caller principal)) 
  (begin
    (asserts! (is-some airlineName) (err u4587))
    (map-set Airlines airline {
      airline-id: (+ (var-get idCounter) u1),
      airline-state: u1,
      airline-name: (unwrap-panic airlineName),
      voters:  (list caller) ,
    })
    (var-set idCounter (+ (var-get idCounter) u1))
    (var-set authAirlines (+ (var-get authAirlines) u1))
    (ok "Airline in application, open for Votes")
  )
)

(define-private (register-airline-vote (airline principal) (caller principal)) 
  (let 
    (
      (airlineData (unwrap-panic (map-get? Airlines airline)))
      (voters (get voters airlineData))
      (newVotes (append (list ) voters) )
      (output 
        (merge airlineData
          {
            voters: (unwrap-panic (as-max-len? (append voters caller) u25)) ,
          }
        )
      )
    )
    (map-set Airlines airline output)
    (ok "Voted on Airline Application")
  )
)



;; public functions
;;
;; whitelisting
(define-read-only (is-whitelisted (app-contract principal))
	(default-to false (map-get? AuthorizedCallers app-contract))
)
;; (contract-call? .flight-surety-data is-whitelisted 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM)


(define-public (set-whitelisted (appContract principal) (whitelisted bool))
	(begin
		(asserts! (is-eq CONTRACT_OWNER tx-sender) ERR_UNAUTHORISED)
    ;; #[filter(appContract, whitelisted)]
		(ok (map-set AuthorizedCallers appContract whitelisted))
	)
)
;; (contract-call? .flight-surety-data set-whitelisted 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM true)

;; airlines
(define-read-only (get-airlines-count) 
  (var-get registeredAirlines)
)
;; (contract-call? .flight-surety-data get-airlines-count)

(define-read-only (get-airline (airline principal)) 
  (map-get? Airlines airline)
)
;; (contract-call? .flight-surety-data get-airline 'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5)


;; assert airline name is given on init
;; assert airline is not registered / funded
(define-public (application-airline (airline principal) (airlineName (optional (string-ascii 30))) (caller principal)) 
  (let
    (
      (airlineState (get airline-state (map-get? Airlines airline)))
    ) 
    (if (is-eq none airlineState)
      ;; #[filter(airline, airlineName, caller)]
      (register-airline-init airline airlineName caller) 
      (register-airline-vote airline caller) 
    )
  )
)
;; (contract-call? .flight-surety-data application-airline 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG "Airline Name" 'ST2REHHS5J3CERCRBEPMGH7921Q6PYKAADT7JP2VB)

(define-public (register-airline (airline principal)) 
  (begin 
    (var-set authAirlines (- (var-get authAirlines) u1))
    (var-set registeredAirlines (+ (var-get registeredAirlines) u1))
    ;; #[filter(airline)]
    (ok (map-set Airlines airline (merge (unwrap-panic (map-get? Airlines airline)) {airline-state: u2}))))
  )
  
;; (contract-call? .flight-surety-data register-airline 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG)

;; assert airline is registered
(define-public (fund-airline (airline principal))
  (begin
    (try! (stx-transfer? u1236 airline CONTRACT_ADDRESS) )
    ;; #[filter(airline)]
    (ok (map-set Airlines airline (merge (unwrap-panic (map-get? Airlines airline)) {airline-state: u3})))
  )
)
;; (contract-call? .flight-surety-data fund-airline 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG)



(define-read-only (get-airline-status (airlineAddress principal))
  (let 
    (
      (status (get airline-state (unwrap! (map-get? Airlines airlineAddress) AIRLINE_NOT_FOUND)))
    ) 
    (ok (unwrap! (element-at AIRLINE_STATE status) BAD_AIRLINE_STATUS))
  )
)
;; (contract-call? .flight-surety-data get-airline-status 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG)

(define-read-only (test-airline (address principal))
  (begin 
    (asserts! (is-some (map-get? Airlines address)) (err u1234))
    (ok (is-airline address))
  )
  
)
;;(contract-call? .flight-surety-data get-airline-status 'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5)
;;(define-public (check-connection (sender principal))
;;  (begin
;;    (asserts! (is-whitelisted sender) not-whitelisted)
;;    (ok {sender: tx-sender, contract: (as-contract tx-sender)})
;;  )
;;)
;;
;;(define-public (count) 
;;  (let 
;;    (
;;      (state (+ (var-get number) u1))
;;    )
;;    (var-set number state)
;;    (ok state)
;;  )
;;)


