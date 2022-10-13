
;; flight-surety-data
;; <add a description here>
;;(impl-trait .data-trait.data-storage-trait)

;; error consts   ;;;********* mainly handled by app, keep only data related no logic
;;
(define-constant ERR_UNAUTHORISED (err u2011))
(define-constant NOT_WHITELISTED (err u2012))

(define-constant AIRLINE_NOT_FOUND (err u2001))
(define-constant BAD_AIRLINE_STATUS (err u2002))
(define-constant AIRLINE_ALREADY_REGISTERED (err u2003))
(define-constant ONLY_BY_REGISTERED_AIRLINE (err u2004))
(define-constant AIRLINE_NOT_IN_APPLICATION (err u2005))
(define-constant AIRLINE_NAME_NOT_PROVIDED (err u2006))
(define-constant ALREADY_VOTED (err u2007))

;; constants
;;
(define-constant CONTRACT_OWNER tx-sender)
(define-constant CONTRACT_ADDRESS (as-contract tx-sender))
(define-constant AIRLINE_FUNDING u1000000)  ;; move to app --> logic
(define-constant AIRLINE_STATE ;; move to app --> logic
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
(define-map RegisteredAirlines { airline-id: uint } { airline: principal })   ;; < implement , could be useful


;; init first airline
(map-set Airlines 'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5
  { 
    airline-id: u1,
    airline-state: u2,
    airline-name: "First Airline",
    voters:  (list ),
  }
)
(var-set registeredAirlines u1)
(var-set idCounter u1)


;; private functions
;;


(define-private (register-airline-init (airline principal) (airlineName (optional (string-ascii 40))) (caller principal))  ;; obsolete 
  (begin
    (map-set Airlines airline {
      airline-id: (+ (var-get idCounter) u1),
      airline-state: u1,
      airline-name: (unwrap-panic airlineName),
      voters:  (list caller) ,
    })
    (var-set idCounter (+ (var-get idCounter) u1))
    (var-set authAirlines (+ (var-get authAirlines) u1))
    (ok {airline-state: u1, votes: u1})
  )
)

(define-private (register-airline-vote (airline principal) (caller principal))     ;; obsolete 
  (let 
    (
      (airlineData (unwrap-panic (map-get? Airlines airline)))
      (voters (get voters airlineData))
      (output (merge airlineData
        {
          voters: (unwrap-panic (as-max-len? (append voters caller) u25)) ,
        }
      ))
    )
    (asserts! (is-none (index-of voters caller)) ALREADY_VOTED)  ;; Ok
    (map-set Airlines airline output)
    (ok {airline-state: u1, votes: (+ (len voters) u1)})
  )
)



;; public functions
;;
;; whitelisting
(define-read-only (is-whitelisted (app-contract principal))
	(default-to false (map-get? AuthorizedCallers app-contract))
)
;; (contract-call? .flight-surety-data is-whitelisted 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM)

;; a) no map  b) u0/u1  c) u2/u3   ab= false  c= true
(define-read-only (has-airline-state (address principal) (minState uint))   ;; possible move to app contract
    (> (+ (default-to u0 (get airline-state (map-get? Airlines address))) u1) minState) 
)
;; (contract-call? .flight-surety-data has-airline-state 'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5 u2)

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
(define-read-only (get-airline-votes (airline principal))
      (len (default-to (list ) (get voters (map-get? Airlines airline))))
)

;; assert airline is not registered / funded
(define-public (application-airline (airline principal) (airlineName (optional (string-ascii 30))) (caller principal))   ;;; obsolete
  (let
    (
      (airlineState (get airline-state (map-get? Airlines airline)))
    )
    (asserts! (is-whitelisted tx-sender) NOT_WHITELISTED)
    (asserts! (has-airline-state caller u2) ONLY_BY_REGISTERED_AIRLINE)
    (asserts! (is-eq (has-airline-state airline u2) false) AIRLINE_ALREADY_REGISTERED)
    (if (is-eq none airlineState)
      ;; #[filter(airline, airlineName, caller)]
      (register-airline-init airline airlineName caller) 
      (register-airline-vote airline caller) 
    )
  )
)

(define-public (register-airline (airline principal))    ;; obsolete
  (begin
    (asserts! (has-airline-state airline u1) AIRLINE_NOT_IN_APPLICATION)
    (asserts! (is-whitelisted contract-caller) NOT_WHITELISTED)  
    (var-set authAirlines (- (var-get authAirlines) u1))
    (var-set registeredAirlines (+ (var-get registeredAirlines) u1))
    ;; #[filter(airline)]
    (ok (map-set Airlines airline (merge (unwrap-panic (map-get? Airlines airline)) {airline-state: u2})))
  )
)

(define-public (add-airline-data (airline principal) (airlineName (string-ascii 30)) (caller principal) (status uint)) 
  (let 
    (
      (airlineData (map-get? Airlines airline))
      (id (if (is-none airlineData) 
          (+ (var-get idCounter) u1) 
          (unwrap-panic (get airline-id airlineData))
      ))
      (votersList (if (is-none airlineData) 
          (list ) 
          (unwrap-panic (get voters airlineData))
      ))
    )
    (asserts! (is-whitelisted contract-caller) NOT_WHITELISTED) ;; contract-caller instead of tx-sender
    (asserts! (has-airline-state caller u2) ONLY_BY_REGISTERED_AIRLINE)
    (asserts! (is-eq (has-airline-state airline u2) false) AIRLINE_ALREADY_REGISTERED)
    (asserts! (is-none (index-of votersList caller)) ALREADY_VOTED)
    (map-set Airlines airline {
      airline-id: id,
      airline-state: status,
      airline-name: airlineName,
      voters:  (unwrap-panic (as-max-len? (append votersList caller) u25)),
    })

    (if (is-none airlineData) (var-set idCounter id) false)
    (if (is-eq status u2) (var-set registeredAirlines (+ (var-get registeredAirlines) u1)) false)
    
    (ok {airline-id: id, airline-state: status, votes: (len votersList), reg-airlines: (var-get registeredAirlines) })
  )
)
  
;; (contract-call? .flight-surety-data register-airline 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG)

;; assert airline is registered
(define-public (fund-airline (airline principal))
  (begin
    (asserts! (has-airline-state airline u2) ONLY_BY_REGISTERED_AIRLINE)
    ;; #[filter(airline)]
    (try! (stx-transfer? AIRLINE_FUNDING airline CONTRACT_ADDRESS) ) ;; the sender principal has to be current tx-sender
    (ok (map-set Airlines airline (merge (unwrap-panic (map-get? Airlines airline)) {airline-state: u3})))
  )
)
;; (contract-call? .flight-surety-data fund-airline 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG)
