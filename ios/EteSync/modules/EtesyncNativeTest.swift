//
//  EtesyncNativeTest.swift
//  etesync
//
//  Created by Me Me on 26/12/2019.
//  Copyright © 2019 650 Industries, Inc. All rights reserved.
//

import XCTest

import EventKit

class EtesyncNativeTest: XCTestCase {

    override func setUp() {
        // Put setup code here. This method is called before the invocation of each test method in the class.
    }

    override func tearDown() {
        // Put teardown code here. This method is called after the invocation of each test method in the class.
    }

    func testSha256() {
        var sha = Sha256()
        sha.update(string: "test")
        var hash = sha.finalize()
        var lastHash = hash
        
        sha = Sha256()
        sha.update(string: "test")
        hash = sha.finalize()
        XCTAssertEqual(hash, lastHash)
        lastHash = hash
        
        sha = Sha256()
        sha.update(string: "test")
        sha.update(number: 1)
        hash = sha.finalize()
        XCTAssertNotEqual(hash, lastHash)
        lastHash = hash
        
        sha = Sha256()
        sha.update(string: "test")
        sha.update(number: 1)
        sha.update(date: Date())
        hash = sha.finalize()
        XCTAssertNotEqual(hash, lastHash)
        lastHash = hash
        
        sha = Sha256()
        sha.update(string: "test")
        sha.update(number: 1)
        sha.update(date: Date())
        hash = sha.finalize()
        XCTAssertNotEqual(hash, lastHash)
        lastHash = hash
    }

    func testEventHash() {
        let calendar = Calendar.current
        let now = Date()
        
        var yearAgoComp = DateComponents()
        yearAgoComp.year = -1
        let yearAgo = calendar.date(byAdding: yearAgoComp, to: now)
        
        let store = EKEventStore()
        let ev1 = EKEvent(eventStore: store)
        ev1.title = "Test title"
        ev1.location = "Somewhere"
        // ev1.timeZone
        // ev1.url
        // ev1.notes
        ev1.startDate = now
        ev1.endDate = now
        ev1.isAllDay = false
        
        let ev1hash = hashEvent(event: ev1)
        
        let ev2 = EKEvent(eventStore: store)
        ev2.title = "Test title"
        ev2.location = "Somewhere"
        ev2.startDate = yearAgo
        ev2.endDate = yearAgo
        ev2.isAllDay = false
        
        let ev2hash = hashEvent(event: ev2)
        
        XCTAssertNotEqual(ev1hash, ev2hash)
    }
}
